import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/shared/env'

/** Что кладём в cookie `oauth` между редиректом на провайдера и callback. */
export type OAuthState = {
  provider: string
  verifier: string
  state: string
  createdAt: number
}

const TTL_MS = 10 * 60 * 1000

/** Cookie с подписанным состоянием OAuth-редиректа. */
export const OAUTH_COOKIE = 'oauth'

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_MS / 1000,
  }
}


function sign(payload: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(payload).digest('base64url')
}

/** Подписывает данные состояния HMAC-SHA256 на `AUTH_SECRET`. */
export function sealState(data: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Проверяет подпись и срок (10 минут). Всё неверное — `null`. */
export function openState(sealed: string): OAuthState | null {
  if (!sealed) return null

  const [payload, signature] = sealed.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null

  let data: OAuthState
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as OAuthState
  } catch {
    return null
  }

  if (typeof data.createdAt !== 'number') return null
  if (Date.now() - data.createdAt > TTL_MS) return null

  return data
}
