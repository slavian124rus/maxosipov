import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/shared/env'

function signature(relPath: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${relPath}:${exp}`).digest('hex')
}

/**
 * Подписанная ссылка на файл: `/media/<path>?exp=<unix>&sig=<hex>`.
 * Срок жизни задаёт вызывающий: видео — 6 часов, фото прогресса — 10 минут.
 */
export function signMediaPath(relPath: string, ttlSec: number, now: Date = new Date()): string {
  const clean = relPath.replace(/^\/+/, '')
  const exp = Math.floor(now.getTime() / 1000) + ttlSec
  const sig = signature(clean, exp, env.MEDIA_URL_SIGNING_SECRET ?? '')
  return `/media/${clean}?exp=${exp}&sig=${sig}`
}

/** Проверяет подпись и срок. Подделка, изменение пути или истечение — `false`. */
export function verifyMediaRequest(
  relPath: string,
  exp: number,
  sig: string,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(exp)) return false
  if (exp * 1000 <= now.getTime()) return false

  const clean = relPath.replace(/^\/+/, '')
  const expected = signature(clean, exp, env.MEDIA_URL_SIGNING_SECRET ?? '')

  const actualBuffer = Buffer.from(sig)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export const VIDEO_URL_TTL_SEC = 6 * 60 * 60
export const PHOTO_URL_TTL_SEC = 10 * 60
