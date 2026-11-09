import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { assertCan, permissionScope, roles, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { computeAccess, type AccessState } from './compute'
import { subscriptionEvents, subscriptions, type SubscriptionEvent } from './schema'

export type SubscriptionFilter = 'all' | 'trial' | 'ending' | 'expired'

export type SubscriptionListItem = {
  userId: string
  name: string
  phone: string
  access: AccessState
  /** Последние события подписки (новые первыми), не больше 10. */
  events: SubscriptionEvent[]
}

const EVENTS_PER_CLIENT = 10
const ENDING_DAYS = 7

function matchesFilter(access: AccessState, filter: SubscriptionFilter): boolean {
  if (filter === 'trial') return access.status === 'trial'
  if (filter === 'expired') return access.status === 'expired'
  if (filter === 'ending') return access.hasAccess && (access.daysLeft ?? Infinity) <= ENDING_DAYS
  return true
}

function matchesQuery(user: { name: string; phone: string }, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const digits = query.replace(/\D/g, '')
  return (
    user.name.toLowerCase().includes(text) || (digits.length > 0 && user.phone.includes(digits))
  )
}

/**
 * Клиенты с подписками, которые актор вправе видеть (ревью F3):
 * область `all` — все клиенты его зала, `own` — только те, кого он ведёт.
 */
export async function listSubscriptionsForActor(
  actor: Actor,
  options: { query?: string; filter?: SubscriptionFilter; now?: Date } = {},
): Promise<SubscriptionListItem[]> {
  assertCan(actor, 'subscriptions.grant')
  const scope = permissionScope(actor, 'subscriptions.grant')
  const now = options.now ?? new Date()

  const rows = await db
    .select({ user: users, sub: subscriptions })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(
      and(
        eq(roles.isClient, true),
        isNull(users.deletedAt),
        eq(users.gymId, actor.gymId),
        scope === 'own' ? eq(users.trainerId, actor.id) : undefined,
      ),
    )
    .orderBy(users.name)

  const visible = rows
    .map(({ user, sub }) => ({ user, access: computeAccess(sub, now) }))
    .filter(({ user }) => matchesQuery(user, options.query ?? ''))
    .filter(({ access }) => matchesFilter(access, options.filter ?? 'all'))

  const ids = visible.map(({ user }) => user.id)
  const events =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(subscriptionEvents)
          .where(inArray(subscriptionEvents.userId, ids))
          .orderBy(desc(subscriptionEvents.createdAt))

  return visible.map(({ user, access }) => ({
    userId: user.id,
    name: user.name,
    phone: user.phone,
    access,
    events: events.filter((event) => event.userId === user.id).slice(0, EVENTS_PER_CLIENT),
  }))
}

/** Конверсия пробного периода: у скольких из закончившихся за период проб был `granted`. */
export async function getTrialConversion(
  now: Date,
  trialDays: number,
  days = 90,
): Promise<{ paid: number; total: number }> {
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const trialMs = trialDays * 24 * 60 * 60 * 1000

  const events = await db
    .select({ userId: subscriptionEvents.userId, type: subscriptionEvents.type, createdAt: subscriptionEvents.createdAt })
    .from(subscriptionEvents)

  const starts = events.filter(
    (event) =>
      event.type === 'trial_started' &&
      event.createdAt.getTime() + trialMs <= now.getTime() &&
      event.createdAt.getTime() >= windowStart.getTime() - trialMs,
  )

  let paid = 0

  for (const start of starts) {
    const granted = events.some(
      (event) =>
        event.type === 'granted' &&
        event.userId === start.userId &&
        event.createdAt.getTime() >= start.createdAt.getTime(),
    )
    if (granted) paid += 1
  }

  return { paid, total: starts.length }
}
export async function listSubscriptionEvents(
  actor: Actor,
  userId: string,
  limit = EVENTS_PER_CLIENT,
): Promise<SubscriptionEvent[]> {
  assertCan(actor, 'subscriptions.grant')
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  assertCan(actor, 'subscriptions.grant', {
    clientId: userId,
    clientTrainerId: user?.trainerId ?? null,
  })
  if (!user || user.gymId !== actor.gymId) return []

  return db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.userId, userId))
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(limit)
}
