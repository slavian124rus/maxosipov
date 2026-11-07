import type { subscriptions, SubscriptionStatus } from './schema'

export type SubscriptionRow = typeof subscriptions.$inferSelect

export type AccessState = {
  hasAccess: boolean
  status: SubscriptionStatus | 'none'
  endsAt: Date | null
  daysLeft: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Доступ = статус `trial` или `active` и `now < ends_at`.
 * Истёкшая, замороженная и отключённая подписка доступа не дают.
 */
export function computeAccess(sub: SubscriptionRow | null, now: Date): AccessState {
  if (!sub) {
    return { hasAccess: false, status: 'none', endsAt: null, daysLeft: null }
  }

  const isActiveStatus = sub.status === 'trial' || sub.status === 'active'
  const hasAccess = isActiveStatus && sub.endsAt.getTime() > now.getTime()

  return {
    hasAccess,
    status: sub.status,
    endsAt: sub.endsAt,
    daysLeft: hasAccess ? Math.ceil((sub.endsAt.getTime() - now.getTime()) / DAY_MS) : null,
  }
}
