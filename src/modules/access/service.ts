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

function phoneHash(phone: string): string {
  return createHash('sha256').update(`${phone}${env.AUTH_SECRET}`).digest('hex')
}

async function findUser(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!row) throw new Error('Пользователь не найден')
  return row
}

async function findSub(userId: string): Promise<SubscriptionRow | null> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId))
  return row ?? null
}

/** Проверяет право на управление подпиской конкретного клиента. */
async function assertGrant(actor: Actor, userId: string): Promise<void> {
  const user = await findUser(userId)
  assertCan(actor, 'subscriptions.grant', { clientId: userId, clientTrainerId: user.trainerId })
}

async function writeEvent(
  userId: string,
  type: (typeof subscriptionEvents.$inferInsert)['type'],
  extra: Partial<typeof subscriptionEvents.$inferInsert> = {},
): Promise<void> {
  await db.insert(subscriptionEvents).values({ userId, type, ...extra })
}

/** Пробный период: один раз на номер телефона. `true`, если выдан сейчас. */
export async function startTrialIfEligible(userId: string, phone: string): Promise<boolean> {
  const hash = phoneHash(phone)

  const [used] = await db
    .select()
    .from(trialRegistry)
    .where(eq(trialRegistry.phoneHash, hash))
    .limit(1)

  if (used) return false

  const existing = await findSub(userId)
  if (existing) return false

  const gym = await getGym()
  const now = new Date()
  const endsAt = addDays(now, gym.settings.trialDays)

  await db
    .insert(trialRegistry)
    .values({ phoneHash: hash, usedAt: now })
    .onConflictDoNothing({ target: trialRegistry.phoneHash })

  await db.insert(subscriptions).values({ userId, status: 'trial', startsAt: now, endsAt })
  await writeEvent(userId, 'trial_started')

  return true
}

/**
 * Выдаёт подписку: ровно одно из `months` / `untilDate`.
 * Продление активной считается от её конца, истёкшей — от сегодня.
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
  const gym = await getGym()
  const current = await findSub(userId)

  const isActiveNow =
    current !== null &&
    (current.status === 'trial' || current.status === 'active') &&
    current.endsAt.getTime() > now.getTime()

  const base = isActiveNow && current ? current.endsAt : now
  const endsAt = input.months
    ? addMonthsClamped(base, input.months, gym.timezone)
    : input.untilDate!

  const [updated] = await db
    .insert(subscriptions)
    .values({ userId, status: 'active', startsAt: current?.startsAt ?? now, endsAt })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { status: 'active', endsAt, frozenAt: null, statusBeforeFreeze: null, updatedAt: now },
    })
    .returning()

  await writeEvent(userId, 'granted', {
    months: input.months ?? null,
    untilDate: input.untilDate ?? null,
    priceRub: input.priceRub ?? null,
    note: input.note ?? null,
    actorId: actor.id,
  })

  return updated!
}

/** Заморозка: доступ пропадает, конец подписки потом сдвинется на срок заморозки. */
export async function freeze(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  const current = await findSub(userId)
  if (!current) throw new Error('Подписки нет')
  if (current.status !== 'trial' && current.status !== 'active') {
    throw new Error('Заморозить можно только активную подписку')
  }

  const now = new Date()
  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'frozen', statusBeforeFreeze: current.status, frozenAt: now, updatedAt: now })
    .where(eq(subscriptions.userId, userId))
    .returning()

  await writeEvent(userId, 'frozen', { actorId: actor.id })
  return updated!
}

/** Разморозка: конец подписки сдвигается ровно на длительность заморозки. */
export async function unfreeze(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  const current = await findSub(userId)
  if (!current) throw new Error('Подписки нет')
  if (current.status !== 'frozen' || !current.frozenAt) {
    throw new Error('Подписка не заморожена')
  }

  const now = new Date()
  const frozenMs = now.getTime() - current.frozenAt.getTime()
  const endsAt = new Date(current.endsAt.getTime() + frozenMs)

  const [updated] = await db
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

  await writeEvent(userId, 'unfrozen', { actorId: actor.id })
  return updated!
}

/** Отключение доступа (например, клиент ушёл из зала). */
export async function disable(actor: Actor, userId: string): Promise<SubscriptionRow> {
  await assertGrant(actor, userId)

  const current = await findSub(userId)
  if (!current) throw new Error('Подписки нет')

  const now = new Date()
  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'disabled', updatedAt: now })
    .where(eq(subscriptions.userId, userId))
    .returning()

  await writeEvent(userId, 'disabled', { actorId: actor.id })
  return updated!
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

