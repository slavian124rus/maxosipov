import type { PgBoss } from 'pg-boss'

/** Очередь-пульс: раз в 10 минут пишет строку в лог. */
export const HEARTBEAT_QUEUE = 'heartbeat'
export const HEARTBEAT_CRON = '*/10 * * * *'

/**
 * Регистрирует фоновые задачи. Сейчас одна — `heartbeat`;
 * сюда же добавятся обработка видео, подписки и уведомления.
 */
export async function registerJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(HEARTBEAT_QUEUE)
  await boss.schedule(HEARTBEAT_QUEUE, HEARTBEAT_CRON)

  await boss.work(HEARTBEAT_QUEUE, async () => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`)
  })
}
