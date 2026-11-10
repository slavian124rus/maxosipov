import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { env } from '@/shared/env'
import { sessions } from './schema'

/** Cookie с токеном сессии. */
export const SESSION_COOKIE = 'sid'

const SESSION_TTL_DAYS = 90
/** Если до конца сессии меньше этого срока — продлеваем при использовании. */
const RENEW_THRESHOLD_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export type CreatedSession = { token: string; expiresAt: Date }
export type ValidatedSession = { userId: string; expiresAt: Date }

/** Создаёт сессию: случайный токен (32 байта, base64url) и его `sha256` в БД. */
export async function createSession(
  userId: string,
  userAgent: string | null,
): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS)

  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt, userAgent })

  return { token, expiresAt }
}

/**
 * Проверяет токен. Просроченный — `null`; если до конца меньше 30 дней,
 * продлевает сессию до 90 дней от текущего момента.
 */
export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  if (!token) return null

  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1)

  if (!row) return null

  const now = new Date()
  if (row.expiresAt.getTime() <= now.getTime()) return null

  const daysLeft = (row.expiresAt.getTime() - now.getTime()) / DAY_MS

  if (daysLeft < RENEW_THRESHOLD_DAYS) {
    const expiresAt = addDays(now, SESSION_TTL_DAYS)
    await db
      .update(sessions)
      .set({ expiresAt, updatedAt: now })
      .where(eq(sessions.id, row.id))
    return { userId: row.userId, expiresAt }
  }

  return { userId: row.userId, expiresAt: row.expiresAt }
}

/** Удаляет сессию (выход). */
export async function destroySession(token: string): Promise<void> {
  if (!token) return
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

/**
 * Домен куки: `app.maxosipov.ru` → `.maxosipov.ru`, чтобы сессия работала и на `admin.maxosipov.ru`.
 * Локально (`app.localhost`, `localhost`) — без домена.
 */
export function cookieDomainFor(appUrl: string): string | undefined {
  const { hostname } = new URL(appUrl)
  const match = /^app\.(.+\..+)$/.exec(hostname)
  return match?.[1] ? `.${match[1]}` : undefined
}

/** Параметры cookie `sid`: 90 дней, `httpOnly`, `secure` в production, `sameSite: 'lax'`. */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    ...(process.env.NODE_ENV === 'production' ? domainOption() : {}),
  }
}

function domainOption(): { domain: string } | Record<string, never> {
  const domain = cookieDomainFor(env.APP_URL)
  return domain ? { domain } : {}
}
