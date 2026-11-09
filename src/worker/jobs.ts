import type { PgBoss } from 'pg-boss'
import { MEDIA_CLEANUP_QUEUE, PHOTO_QUEUE, PROCESS_MEDIA_QUEUE, QUEUE_TUNING } from '@/modules/media'
import { registerAuthCleanup } from './jobs/auth-cleanup'
import { registerExpireSubscriptions } from './jobs/expire-subscriptions'
import { cleanupAbandonedUploads, cleanupOriginals } from './jobs/media-cleanup'
import { MUSCLE_OVERLAY_QUEUE, muscleOverlayJob, profilesForMedia } from './jobs/muscle-overlay'
import { processMediaJob } from './jobs/process-media'
import { processPhotoJob } from './jobs/process-photo'
import { sessionSummaryJob } from './jobs/session-summary'

/** Очередь-пульс: раз в 10 минут пишет строку в лог. */
export const HEARTBEAT_QUEUE = 'heartbeat'
export const HEARTBEAT_CRON = '*/10 * * * *'

export { MEDIA_CLEANUP_QUEUE, PROCESS_MEDIA_QUEUE }

/** Ночная уборка исходников и временных файлов. */
export const MEDIA_CLEANUP_CRON = '0 4 * * *'

/** Создаёт очередь и применяет настройки, даже если веб успел создать её раньше. */
async function createTunedQueue(boss: PgBoss, name: string): Promise<void> {
  const tuning = QUEUE_TUNING[name]
  await boss.createQueue(name, tuning)
  if (tuning) await boss.updateQueue(name, tuning)
}

/** Итог тренировки от МаксИИма — обработчик появится на этапе 4. */
export const SESSION_SUMMARY_QUEUE = 'session.summary'

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

  await createTunedQueue(boss, PROCESS_MEDIA_QUEUE)
  await boss.work<{ mediaId: string }>(PROCESS_MEDIA_QUEUE, { batchSize: 1 }, async ([job]) => {
    if (!job) return
    console.log(`[worker] media.process ${job.data.mediaId}`)
    await processMediaJob(job.data)

    // Подсветка — отдельной задачей: её ошибка не мешает публикации.
    for (const profile of await profilesForMedia(job.data.mediaId)) {
      await boss.send(MUSCLE_OVERLAY_QUEUE, { mediaId: job.data.mediaId, profile })
    }
  })

  await createTunedQueue(boss, MUSCLE_OVERLAY_QUEUE)
  await boss.work<{ mediaId: string; profile: 'pull_vertical' | 'pull_horizontal' }>(
    MUSCLE_OVERLAY_QUEUE,
    { batchSize: 1 },
    async ([job]) => {
      if (!job) return
      await muscleOverlayJob(job.data)
    },
  )

  await boss.createQueue(MEDIA_CLEANUP_QUEUE)
  await boss.schedule(MEDIA_CLEANUP_QUEUE, MEDIA_CLEANUP_CRON)
  await boss.work(MEDIA_CLEANUP_QUEUE, async () => {
    const now = new Date()
    const originals = await cleanupOriginals(now)
    const abandoned = await cleanupAbandonedUploads(now)
    console.log(`[worker] media.cleanup: исходников — ${originals}, брошенных загрузок — ${abandoned}`)
  })

  // Итог МаксИИма после завершения тренировки (этап 4).
  await boss.createQueue(SESSION_SUMMARY_QUEUE)
  await boss.work<{ sessionId: string }>(SESSION_SUMMARY_QUEUE, async ([job]) => {
    if (!job) return
    await sessionSummaryJob(job.data)
  })

  // Фото прогресса: sharp, без ffmpeg.
  await createTunedQueue(boss, PHOTO_QUEUE)
  await boss.work<{ mediaId: string }>(PHOTO_QUEUE, { batchSize: 1 }, async ([job]) => {
    if (!job) return
    console.log(`[worker] media.photo ${job.data.mediaId}`)
    await processPhotoJob(job.data)
  })
}

