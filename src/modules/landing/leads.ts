import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { normalizePhone, users } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { notify, notifyLeadInTelegram } from '@/modules/notifications'
import { assertCan, can, roles, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { leads, type Lead } from './schema'

export const LEAD_NAME_MIN = 2
export const LEAD_NAME_MAX = 60
/** Не больше 5 заявок с одного IP в час (план, Global Constraints). */
export const LEADS_PER_HOUR = 5
/** Повтор того же номера за 10 минут новой заявкой не считается. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
/** Сколько заявок показываем тренеру: режем в SQL, а не в памяти (ревью этапа 5, F13). */
export const LEADS_LIST_LIMIT = 200

const HOUR_MS = 60 * 60 * 1000

/** Форма присылает строки; тип и длину проверяем до бизнес-логики (ревью этапа 3, F8). */
export const leadInputSchema = z.object({
  name: z.string().max(200),
  phone: z.string().max(40),
  consent: z.boolean(),
  ip: z.string().max(64),
  source: z.literal('landing'),
})

export type CreateLeadInput = z.infer<typeof leadInputSchema>

export type CreateLeadResult = { ok: true } | { ok: false; error: string }

type TransactionOutcome =
  | { kind: 'created'; lead: Lead }
  | { kind: 'duplicate' }
  | { kind: 'limited' }

/**
 * Принимает заявку с лендинга.
 *
 * Лимит по IP и дедупликация номера проверяются в одной транзакции под блокировкой
 * по IP: параллельные нажатия «Отправить» не обходят ни то, ни другое
 * (уроки ревью этапа 4, F2 и этапа 5, F6). Дубль за 10 минут возвращает `ok: true`
 * без новой записи — человек не видит ошибку из-за второго тапа.
 */
export async function createLead(
  input: CreateLeadInput,
  now: Date = new Date(),
): Promise<CreateLeadResult> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < LEAD_NAME_MIN || name.length > LEAD_NAME_MAX) {
    return { ok: false, error: `Проверь имя: от ${LEAD_NAME_MIN} до ${LEAD_NAME_MAX} символов` }
  }

  const phone = normalizePhone(input.phone)
  if (!phone) return { ok: false, error: 'Проверь номер' }

  if (input.consent !== true) {
    return { ok: false, error: 'Нужно согласие на обработку данных' }
  }

  const ip = input.ip.trim() || 'unknown'
  const hourAgo = new Date(now.getTime() - HOUR_MS)
  const duplicateSince = new Date(now.getTime() - DUPLICATE_WINDOW_MS)

  const outcome = await db.transaction(async (tx): Promise<TransactionOutcome> => {
    // Последовательные проверки для одного IP: гонка двойного нажатия не проходит.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ip})::bigint)`)

    const [recent] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.phone, phone), gte(leads.createdAt, duplicateSince)))
      .limit(1)

    if (recent) return { kind: 'duplicate' }

    const [counted] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.ip, ip), gte(leads.createdAt, hourAgo)))

    if ((counted?.total ?? 0) >= LEADS_PER_HOUR) return { kind: 'limited' }

    const [lead] = await tx
      .insert(leads)
      .values({ name, phone, ip, source: input.source, consentAt: now, createdAt: now, updatedAt: now })
      .returning()

    return lead ? { kind: 'created', lead } : { kind: 'duplicate' }
  })

  if (outcome.kind === 'limited') {
    return { ok: false, error: 'Слишком много заявок, попробуй позже' }
  }

  // Заявка уже сохранена: сбой уведомлений не должен показывать человеку ошибку.
  if (outcome.kind === 'created') {
    try {
      await notifyAboutLead(outcome.lead)
    } catch (error) {
      console.error('[landing] уведомление о заявке не ушло', error)
    }
  }

  return { ok: true }
}

/**
 * Дублирует заявку в Telegram-группу и уведомляет всех сотрудников зала с правом `clients.view` (план, задача 3).
 * Право проверяется через `rbac.can`, а не сравнением роли (CLAUDE.md §2.7);
 * сначала фильтр по залу и праву, потом отправка — без лишних адресатов.
 */
async function notifyAboutLead(lead: Lead): Promise<void> {
  // Telegram-группа тренера: сбой не должен лишать сотрудников уведомления в приложении.
  try {
    await notifyLeadInTelegram({ name: lead.name, phone: lead.phone })
  } catch (error) {
    console.error('[landing] заявка не ушла в Telegram', error)
  }

  const gym = await getGym()

  const staff = await db
    .select({
      id: users.id,
      roleId: roles.id,
      gymId: users.gymId,
      isOwner: roles.isSystem,
      permissions: roles.permissions,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.gymId, gym.id), eq(roles.isClient, false), isNull(users.deletedAt)))

  const recipients = staff.filter((person) =>
    can(
      {
        id: person.id,
        roleId: person.roleId,
        gymId: person.gymId,
        isOwner: person.isOwner,
        permissions: person.permissions,
      },
      'clients.view',
    ),
  )

  for (const person of recipients) {
    await notify(person.id, 'new_lead', { name: lead.name, phone: lead.phone })
  }
}

/** Заявки для кабинета тренера: новые сверху, право `clients.view`, лимит в SQL. */
export async function listLeads(actor: Actor): Promise<Lead[]> {
  assertCan(actor, 'clients.view')

  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(LEADS_LIST_LIMIT)
}

/** Отметка «Связался». Повторное нажатие не перезаписывает время первого звонка. */
export async function markLeadContacted(
  actor: Actor,
  leadId: string,
  now: Date = new Date(),
): Promise<void> {
  assertCan(actor, 'clients.view')

  await db
    .update(leads)
    .set({ contactedAt: now, updatedAt: now })
    .where(and(eq(leads.id, leadId), isNull(leads.contactedAt)))
}
