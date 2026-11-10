import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { assertCan, permissionScope, roles, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { computeAccess, type AccessState } from './compute'
import { subscriptionEvents, subscriptions, type SubscriptionEvent } from './schema'

export type SubscriptionFilter = 'all' | 'trial' | 'ending' | 'expired'

export type SubscriptionListItem = {
  userId: string
  name: string
  /** Телефон или, если его нет, почта. */
  contact: string
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

function matchesQuery(user: { name: string; phone: string | null; email: string | null }, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const digits = query.replace(/\D/g, '')
  return (
    user.name.toLowerCase().includes(text) || (digits.length > 0 && (user.phone ?? '').includes(digits)) ||
    (user.email ?? '').includes(text)
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
    contact: user.phone ?? user.email ?? '',
    access,
    events: events.filter((event) => event.userId === user.id).slice(0, EVENTS_PER_CLIENT),
  }))
}

/**
 * Конверсия пробного периода: у скольких из закончившихся за период проб был `granted`.
 * Из базы читаются только пробы, закончившиеся в окне, и выдачи их владельцев — не вся история.
 * `userIds` сужает расчёт до видимых актору клиентов.
 */
export async function getTrialConversion(
  now: Date,
  trialDays: number,
  days = 90,
  userIds?: string[],
): Promise<{ paid: number; total: number }> {
  if (userIds && userIds.length === 0) return { paid: 0, total: 0 }

  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const trialMs = trialDays * 24 * 60 * 60 * 1000

  const starts = await db
    .select({ userId: subscriptionEvents.userId, createdAt: subscriptionEvents.createdAt })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.type, 'trial_started'),
        gte(subscriptionEvents.createdAt, new Date(windowStart.getTime() - trialMs)),
        lte(subscriptionEvents.createdAt, new Date(now.getTime() - trialMs)),
        userIds ? inArray(subscriptionEvents.userId, userIds) : undefined,
      ),
    )

  if (starts.length === 0) return { paid: 0, total: 0 }

  const grants = await db
    .select({ userId: subscriptionEvents.userId, createdAt: subscriptionEvents.createdAt })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.type, 'granted'),
        inArray(subscriptionEvents.userId, [...new Set(starts.map((start) => start.userId))]),
      ),
    )

  const paid = starts.filter((start) =>
    grants.some(
      (grant) =>
        grant.userId === start.userId && grant.createdAt.getTime() >= start.createdAt.getTime(),
    ),
  ).length

  return { paid, total: starts.length }
}

/** История подписки одного клиента — с проверкой права на этого клиента. */
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
