import { createHash } from 'node:crypto'
import { and, eq, inArray, lte } from 'drizzle-orm'
import { getGym } from '@/modules/gym'
import { assertCan, can, loadActor, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { env } from '@/shared/env'
import { addDays, addMonthsClamped } from './dates'
import { computeAccess, type AccessState, type SubscriptionRow } from './compute'
import { subscriptionEvents, subscriptions, trialRegistry } from './schema'

const GRANT_MONTHS = new Set([1, 3, 6, 12])

export type GrantInput = {
  months?: 1 | 3 | 6 | 12
  untilDate?: Date
  priceRub?: number
  note?: string
}

function phoneHash(key: string): string {
  return createHash('sha256').update(`${key}${env.AUTH_SECRET}`).digest('hex')
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Db = typeof db | Tx

async function findUser(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!row) throw new Error('Пользователь не найден')
  return row
}

/** Текущая подписка; внутри транзакции — с блокировкой строки до конца транзакции. */
async function findSub(userId: string, tx: Db = db, lock = false): Promise<SubscriptionRow | null> {
  const query = tx.select().from(subscriptions).where(eq(subscriptions.userId, userId))
  const [row] = lock ? await query.for('update') : await query
  return row ?? null
}

/**
 * Право на подписку конкретного клиента. Сначала право вообще (без цели) —
 * посторонний не узнаёт, существует ли пользователь (ревью F5).
 */
async function assertGrant(actor: Actor, userId: string): Promise<void> {
  assertCan(actor, 'subscriptions.grant')
  const user = await findUser(userId)
  assertCan(actor, 'subscriptions.grant', { clientId: userId, clientTrainerId: user.trainerId })
}

async function writeEvent(
  tx: Db,
  userId: string,
  type: (typeof subscriptionEvents.$inferInsert)['type'],
  extra: Partial<typeof subscriptionEvents.$inferInsert> = {},
): Promise<void> {
  await tx.insert(subscriptionEvents).values({ userId, type, ...extra })
}

/**
 * Пробный период: один раз на ключ (номер телефона или `email:<канонический адрес>`). `true`, если выдан сейчас.
 * Номер «занимается» вставкой в `trial_registry` с `ON CONFLICT DO NOTHING` —
 * два параллельных входа не получат два пробных периода (ревью F5).
 */
export async function startTrialIfEligible(userId: string, trialKey: string): Promise<boolean> {
  const gym = await getGym()

  return db.transaction(async (tx) => {
    if (await findSub(userId, tx, true)) return false

    const now = new Date()
    const [claimed] = await tx
      .insert(trialRegistry)
      .values({ phoneHash: phoneHash(trialKey), usedAt: now })
      .onConflictDoNothing({ target: trialRegistry.phoneHash })
      .returning({ phoneHash: trialRegistry.phoneHash })

    if (!claimed) return false

    await tx
      .insert(subscriptions)
      .values({ userId, status: 'trial', startsAt: now, endsAt: addDays(now, gym.settings.trialDays) })
    await writeEvent(tx, userId, 'trial_started')
    return true
  })
}

/** От какой даты продлевать: активная — от конца, замороженная — от конца + срок заморозки, иначе — от сегодня. */
function extensionBase(current: SubscriptionRow | null, now: Date): Date {
  if (!current) return now
  const endsMs = current.endsAt.getTime()

  if ((current.status === 'trial' || current.status === 'active') && endsMs > now.getTime()) {
    return current.endsAt
  }
  if (current.status === 'frozen' && current.frozenAt) {
    const shifted = endsMs + (now.getTime() - current.frozenAt.getTime())
    return shifted > now.getTime() ? new Date(shifted) : now
  }
  return now
}

/**
 * Выдаёт подписку: ровно одно из `months` / `untilDate`.
 * Продление активной считается от её конца, замороженной — с учётом заморозки,
 * истёкшей — от сегодня.
 */
export async function grant(
  actor: Actor,
  userId: string,
  input: GrantInput,
): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  const hasMonths = input.months !== undefined
  const hasUntil = input.untilDate !== undefined
  if (hasMonths === hasUntil) {
    throw new Error('Нужно указать ровно одно: months или untilDate')
  }
  if (input.months !== undefined && !GRANT_MONTHS.has(input.months)) {
    throw new Error('Можно продлить на 1, 3, 6 или 12 месяцев')
  }

  const now = new Date()
  if (input.untilDate !== undefined && input.untilDate.getTime() <= now.getTime()) {
    throw new Error('Дата должна быть в будущем')
  }

  const gym = await getGym()

  return db.transaction(async (tx) => {
    const current = await findSub(userId, tx, true)
    const base = extensionBase(current, now)
    const endsAt = input.months
      ? addMonthsClamped(base, input.months, gym.timezone)
      : input.untilDate!

    const [updated] = await tx
      .insert(subscriptions)
      .values({ userId, status: 'active', startsAt: current?.startsAt ?? now, endsAt })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { status: 'active', endsAt, frozenAt: null, statusBeforeFreeze: null, updatedAt: now },
      })
      .returning()

    await writeEvent(tx, userId, 'granted', {
      months: input.months ?? null,
      untilDate: input.untilDate ?? null,
      priceRub: input.priceRub ?? null,
      note: input.note ?? null,
      actorId: actor.id,
    })

    return updated!
  })
}

/** Заморозка: доступ пропадает, конец подписки потом сдвинется на срок заморозки. */
export async function freeze(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  return db.transaction(async (tx) => {
    const current = await findSub(userId, tx, true)
    if (!current) throw new Error('Подписки нет')
    if (current.status !== 'trial' && current.status !== 'active') {
      throw new Error('Заморозить можно только активную подписку')
    }

    const now = new Date()
    const [updated] = await tx
      .update(subscriptions)
      .set({ status: 'frozen', statusBeforeFreeze: current.status, frozenAt: now, updatedAt: now })
      .where(eq(subscriptions.userId, userId))
      .returning()

    await writeEvent(tx, userId, 'frozen', { actorId: actor.id })
    return updated!
  })
}

/** Разморозка: конец подписки сдвигается ровно на длительность заморозки. */
export async function unfreeze(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  return db.transaction(async (tx) => {
    const current = await findSub(userId, tx, true)
    if (!current) throw new Error('Подписки нет')
    if (current.status !== 'frozen' || !current.frozenAt) {
      throw new Error('Подписка не заморожена')
    }

    const now = new Date()
    const frozenMs = now.getTime() - current.frozenAt.getTime()
    const endsAt = new Date(current.endsAt.getTime() + frozenMs)

    const [updated] = await tx
      .update(subscriptions)
      .set({
        status: current.statusBeforeFreeze ?? 'active',
        frozenAt: null,
        statusBeforeFreeze: null,
        endsAt,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId))
      .returning()

    await writeEvent(tx, userId, 'unfrozen', { actorId: actor.id })
    return updated!
  })
}

/** Отключение доступа (например, клиент ушёл из зала). */
export async function disable(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  return db.transaction(async (tx) => {
    const current = await findSub(userId, tx, true)
    if (!current) throw new Error('Подписки нет')

    const now = new Date()
    const [updated] = await tx
      .update(subscriptions)
      .set({ status: 'disabled', updatedAt: now })
      .where(eq(subscriptions.userId, userId))
      .returning()

    await writeEvent(tx, userId, 'disabled', { actorId: actor.id })
    return updated!
  })
}

/**
 * Доступ пользователя для интерфейса. `bypass` — владелец и те, кто может
 * выдавать подписки: им доступны все экраны всегда.
 */
export async function getAccessForUser(
  userId: string,
): Promise<AccessState & { bypass: boolean }> {
  const sub = await findSub(userId)
  const state = computeAccess(sub, new Date())

  let bypass = false
  try {
    const actor = await loadActor(userId)
    bypass = actor.isOwner || can(actor, 'subscriptions.grant')
  } catch {
    bypass = false
  }

  return { ...state, bypass }
}

/** Переводит истёкшие `trial`/`active` в `expired`. Возвращает количество. */
export async function expireSubscriptions(now: Date): Promise<number> {
  const expired = await db
    .update(subscriptions)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(inArray(subscriptions.status, ['trial', 'active']), lte(subscriptions.endsAt, now)),
    )
    .returning({ userId: subscriptions.userId })

  if (expired.length > 0) {
    await db
      .insert(subscriptionEvents)
      .values(expired.map((row) => ({ userId: row.userId, type: 'expired' as const })))
  }

  return expired.length
}

