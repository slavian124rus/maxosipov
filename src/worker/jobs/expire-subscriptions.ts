import type { PgBoss } from 'pg-boss'
import { expireSubscriptions } from '@/modules/access'

export const EXPIRE_SUBSCRIPTIONS_QUEUE = 'subscriptions.expire'
export const EXPIRE_SUBSCRIPTIONS_CRON = '0 * * * *'

/** Раз в час переводит истёкшие подписки в `expired`. */
export async function registerExpireSubscriptions(boss: PgBoss): Promise<void> {
  await boss.createQueue(EXPIRE_SUBSCRIPTIONS_QUEUE)
  await boss.schedule(EXPIRE_SUBSCRIPTIONS_QUEUE, EXPIRE_SUBSCRIPTIONS_CRON)

  await boss.work(EXPIRE_SUBSCRIPTIONS_QUEUE, async () => {
    const count = await expireSubscriptions(new Date())
    console.log(`[worker] ${EXPIRE_SUBSCRIPTIONS_QUEUE}: истекло подписок — ${count}`)
  })
}
