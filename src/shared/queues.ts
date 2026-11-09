/** Имена очередей pg-boss (через точку, не через двоеточие). */
export const PROCESS_MEDIA_QUEUE = 'media.process'
export const MUSCLE_OVERLAY_QUEUE = 'media.muscles'
export const MEDIA_CLEANUP_QUEUE = 'media.cleanup'
export const PHOTO_QUEUE = 'media.photo'

export type QueueTuning = { expireInSeconds: number; retryLimit: number }

/**
 * Настройки очередей. По умолчанию задача живёт 15 минут и повторяется дважды, а стабилизация
 * и VP9 на VPS с 2 ядрами для длинного ролика могут идти дольше: тогда задача запустилась бы
 * второй раз параллельно с первой. Одни и те же значения использует и веб (создаёт очередь),
 * и воркер (обновляет её).
 */
export const QUEUE_TUNING: Record<string, QueueTuning> = {
  [PROCESS_MEDIA_QUEUE]: { expireInSeconds: 60 * 60, retryLimit: 1 },
  [MUSCLE_OVERLAY_QUEUE]: { expireInSeconds: 60 * 60, retryLimit: 0 },
  [PHOTO_QUEUE]: { expireInSeconds: 600, retryLimit: 1 },
}
