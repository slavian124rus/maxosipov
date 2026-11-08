import { and, isNotNull, lt, or } from 'drizzle-orm'
import { db } from '@/shared/db'
import { cleanupPendingLinks } from './pending-link'
import { otpCodes, sessions } from './schema'

const OTP_KEEP_MS = 2 * 24 * 60 * 60 * 1000

export type AuthCleanupResult = { sessions: number; otpCodes: number; pendingLinks: number }

/**
 * Ночная уборка служебных таблиц входа (ревью F7): просроченные сессии,
 * коды старше двух суток (сутки нужны для дневного лимита неверных вводов),
 * истёкшие привязки провайдеров.
 */
export async function cleanupAuth(now: Date): Promise<AuthCleanupResult> {
  const removedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id })

  const otpBefore = new Date(now.getTime() - OTP_KEEP_MS)
  const removedOtp = await db
    .delete(otpCodes)
    .where(
      and(
        lt(otpCodes.createdAt, otpBefore),
        or(isNotNull(otpCodes.consumedAt), lt(otpCodes.expiresAt, now)),
      ),
    )
    .returning({ id: otpCodes.id })

  return {
    sessions: removedSessions.length,
    otpCodes: removedOtp.length,
    pendingLinks: await cleanupPendingLinks(now),
  }
}
