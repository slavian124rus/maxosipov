import { createHash, randomInt } from 'node:crypto'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { otpCodes } from './schema'
import { getSmsProvider } from './sms'

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_REQUESTS_PER_PHONE = 3
const OTP_MAX_REQUESTS_PER_IP = 20
const OTP_MAX_ATTEMPTS = 5
const HOUR_MS = 60 * 60 * 1000

/** В dev для тестовых номеров код всегда `1111`, СМС не уходит. */
const DEV_PHONE = /^\+7999000\d{4}$/
const DEV_CODE = '1111'

export type RequestOtpResult = { ok: true } | { ok: false; reason: 'rate_phone' | 'rate_ip' }
export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }

function hashOtp(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex')
}

function generateCode(): string {
  return String(randomInt(0, 10000)).padStart(4, '0')
}

function isDevPhone(phone: string): boolean {
  return process.env.NODE_ENV !== 'production' && DEV_PHONE.test(phone)
}

export function otpText(code: string): string {
  return `Код входа МаксИИм: ${code}. Никому его не сообщай.`
}

async function countSince(column: typeof otpCodes.phone | typeof otpCodes.ip, value: string) {
  const hourAgo = new Date(Date.now() - HOUR_MS)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(and(eq(column, value), gte(otpCodes.createdAt, hourAgo)))
  return row?.count ?? 0
}

/** Запрашивает код: проверяет лимиты, пишет хэш в БД и отправляет СМС. */
export async function requestOtp(phone: string, ip: string): Promise<RequestOtpResult> {
  if ((await countSince(otpCodes.phone, phone)) >= OTP_MAX_REQUESTS_PER_PHONE) {
    return { ok: false, reason: 'rate_phone' }
  }
  if ((await countSince(otpCodes.ip, ip)) >= OTP_MAX_REQUESTS_PER_IP) {
    return { ok: false, reason: 'rate_ip' }
  }

  const dev = isDevPhone(phone)
  const code = dev ? DEV_CODE : generateCode()
  const now = new Date()

  await db.insert(otpCodes).values({
    phone,
    codeHash: hashOtp(phone, code),
    ip,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    // время из JS, а не из БД: лимиты считаются по тем же часам, что и выдача кода
    createdAt: now,
    updatedAt: now,
  })

  if (!dev) {
    await getSmsProvider().send(phone, otpText(code))
  }

  return { ok: true }
}

/** Проверяет код: 5 минут, не больше 5 попыток, один раз. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (!row) return { ok: false, reason: 'invalid' }
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' }

  const now = new Date()

  if (row.codeHash !== hashOtp(phone, code)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1, updatedAt: now })
      .where(eq(otpCodes.id, row.id))
    return { ok: false, reason: 'invalid' }
  }

  await db
    .update(otpCodes)
    .set({ consumedAt: now, updatedAt: now })
    .where(eq(otpCodes.id, row.id))

  return { ok: true }
}
