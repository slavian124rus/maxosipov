import type { PgBoss } from 'pg-boss'
import { cleanupAuth } from '@/modules/auth'

export const AUTH_CLEANUP_QUEUE = 'auth.cleanup'
/** Каждую ночь в 03:00 по Красноярску. */
export const AUTH_CLEANUP_CRON = '0 3 * * *'

export async function registerAuthCleanup(boss: PgBoss): Promise<void> {
  await boss.createQueue(AUTH_CLEANUP_QUEUE)
  await boss.schedule(AUTH_CLEANUP_QUEUE, AUTH_CLEANUP_CRON, undefined, { tz: 'Asia/Krasnoyarsk' })

  await boss.work(AUTH_CLEANUP_QUEUE, async () => {
    const result = await cleanupAuth(new Date())
    console.log(`[worker] ${AUTH_CLEANUP_QUEUE}:`, result)
  })
}
