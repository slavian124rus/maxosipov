import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm'
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
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' | 'locked_day' }

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
  const dev = isDevPhone(phone)

  // Для тестовых номеров лимит не нужен: код фиксированный, СМС не уходит,
  // а e2e-прогоны повторяются. В production ветка недостижима.
  if (!dev) {
    if ((await countSince(otpCodes.phone, phone)) >= OTP_MAX_REQUESTS_PER_PHONE) {
      return { ok: false, reason: 'rate_phone' }
    }
    if ((await countSince(otpCodes.ip, ip)) >= OTP_MAX_REQUESTS_PER_IP) {
      return { ok: false, reason: 'rate_ip' }
    }
  }

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

const OTP_MAX_FAILED_PER_DAY = 10
const DAY_MS = 24 * HOUR_MS

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Неверные вводы по номеру за последние сутки (успешный ввод тоже тратит попытку — вычитаем его). */
async function failedAttemptsLastDay(phone: string, now: Date): Promise<number> {
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const [row] = await db
    .select({
      failed: sql<number>`coalesce(sum(${otpCodes.attempts}), 0)::int - count(${otpCodes.consumedAt})::int`,
    })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, dayAgo)))
  return row?.failed ?? 0
}

/**
 * Проверяет код: 5 минут, не больше 5 попыток на код и 10 неверных вводов на номер в сутки,
 * один раз. Попытка «забирается» атомарным UPDATE до сравнения — параллельные запросы
 * не могут обойти лимит (ревью F2).
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const now = new Date()

  if ((await failedAttemptsLastDay(phone, now)) >= OTP_MAX_FAILED_PER_DAY) {
    return { ok: false, reason: 'locked_day' }
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (!row) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }

  const [claimed] = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1`, updatedAt: now })
    .where(
      and(
        eq(otpCodes.id, row.id),
        lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, now),
      ),
    )
    .returning({ id: otpCodes.id })

  if (!claimed) {
    const [latest] = await db.select().from(otpCodes).where(eq(otpCodes.id, row.id)).limit(1)
    if (latest?.consumedAt) return { ok: false, reason: 'invalid' }
    if (latest && latest.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'too_many_attempts' }
  }

  if (!hashesEqual(row.codeHash, hashOtp(phone, code))) {
    return { ok: false, reason: 'invalid' }
  }

  const [consumed] = await db
    .update(otpCodes)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id })

  return consumed ? { ok: true } : { ok: false, reason: 'invalid' }
}
