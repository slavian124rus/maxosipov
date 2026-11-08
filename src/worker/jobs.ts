import type { PgBoss } from 'pg-boss'
import { registerAuthCleanup } from './jobs/auth-cleanup'
import { registerExpireSubscriptions } from './jobs/expire-subscriptions'
import { cleanupOriginals } from './jobs/media-cleanup'
import { processMediaJob } from './jobs/process-media'

/** Очередь-пульс: раз в 10 минут пишет строку в лог. */
export const HEARTBEAT_QUEUE = 'heartbeat'
export const HEARTBEAT_CRON = '*/10 * * * *'

/** Обработка видео: одно за раз, чтобы ffmpeg не съел всю память. */
export const PROCESS_MEDIA_QUEUE = 'media.process'
/** Ночная уборка исходников старше 30 дней. */
export const MEDIA_CLEANUP_QUEUE = 'media.cleanup'
export const MEDIA_CLEANUP_CRON = '0 4 * * *'

/**
 * Регистрирует фоновые задачи: пульс, подписки, очистку входа, обработку видео, уборку медиа.
 */
export async function registerJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(HEARTBEAT_QUEUE)
  await boss.schedule(HEARTBEAT_QUEUE, HEARTBEAT_CRON)

  await boss.work(HEARTBEAT_QUEUE, async () => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`)
  })

  await registerExpireSubscriptions(boss)
  await registerAuthCleanup(boss)

  await boss.createQueue(PROCESS_MEDIA_QUEUE)
  await boss.work<{ mediaId: string }>(PROCESS_MEDIA_QUEUE, { batchSize: 1 }, async ([job]) => {
    if (!job) return
    console.log(`[worker] media.process ${job.data.mediaId}`)
    await processMediaJob(job.data)
  })

  await boss.createQueue(MEDIA_CLEANUP_QUEUE)
  await boss.schedule(MEDIA_CLEANUP_QUEUE, MEDIA_CLEANUP_CRON)
  await boss.work(MEDIA_CLEANUP_QUEUE, async () => {
    const removed = await cleanupOriginals(new Date())
    console.log(`[worker] media.cleanup: удалено исходников — ${removed}`)
  })
}

