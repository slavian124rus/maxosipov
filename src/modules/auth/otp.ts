import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { otpCodes } from './schema'
import { getEmailProvider } from './mail'
import { getSmsProvider } from './sms'

const OTP_MAX_REQUESTS_PER_IP = 20
const OTP_MAX_REQUESTS_PER_TARGET = 3
const OTP_MAX_ATTEMPTS = 5
const OTP_MAX_FAILED_PER_DAY = 10
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Один код входа работает одинаково для двух каналов: СМС (4 цифры, 5 минут) и письмо
 * (6 цифр, 10 минут — письма идут медленнее СМС, а перебор шести цифр дороже).
 * Лимиты и защита от перебора общие.
 */
type Channel = {
  field: 'phone' | 'email'
  column: typeof otpCodes.phone | typeof otpCodes.email
  digits: number
  ttlMs: number
}

const PHONE_CHANNEL: Channel = { field: 'phone', column: otpCodes.phone, digits: 4, ttlMs: 5 * 60 * 1000 }
const EMAIL_CHANNEL: Channel = { field: 'email', column: otpCodes.email, digits: 6, ttlMs: 10 * 60 * 1000 }

/** В dev для тестовых номеров код всегда `1111`, СМС не уходит. */
const DEV_PHONE = /^\+7999000\d{4}$/
const DEV_CODE = '1111'
/** То же для почты: `*@dev.maxosipov.test`, код `111111`, письмо не уходит. */
const DEV_EMAIL = /@dev\.maxosipov\.test$/
const DEV_EMAIL_CODE = '111111'

export type RequestOtpResult = { ok: true } | { ok: false; reason: 'rate_phone' | 'rate_ip' }
export type RequestEmailOtpResult = { ok: true } | { ok: false; reason: 'rate_email' | 'rate_ip' }
export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' | 'locked_day' }

function hashOtp(target: string, code: string): string {
  return createHash('sha256').update(`${target}:${code}`).digest('hex')
}

function generateCode(digits: number): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, '0')
}

function isDevPhone(phone: string): boolean {
  return process.env.NODE_ENV !== 'production' && DEV_PHONE.test(phone)
}

export function otpText(code: string): string {
  return `Код входа МаксИИм: ${code}. Никому его не сообщай.`
}

function isDevEmail(email: string): boolean {
  return process.env.NODE_ENV !== 'production' && DEV_EMAIL.test(email)
}

async function countSince(
  column: typeof otpCodes.phone | typeof otpCodes.email | typeof otpCodes.ip,
  value: string,
) {
  const hourAgo = new Date(Date.now() - HOUR_MS)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(and(eq(column, value), gte(otpCodes.createdAt, hourAgo)))
  return row?.count ?? 0
}

/**
 * Общая выдача кода: лимиты, хэш в БД, доставка. `dev` — тестовый адрес с фиксированным кодом
 * (в production недостижимо): лимит не нужен, а e2e-прогоны повторяются.
 */
async function issueCode(
  channel: Channel,
  target: string,
  ip: string,
  options: { dev: boolean; devCode: string; deliver: (code: string) => Promise<void> },
): Promise<'ok' | 'rate_target' | 'rate_ip'> {
  if (!options.dev) {
    if ((await countSince(channel.column, target)) >= OTP_MAX_REQUESTS_PER_TARGET) return 'rate_target'
    if ((await countSince(otpCodes.ip, ip)) >= OTP_MAX_REQUESTS_PER_IP) return 'rate_ip'
  }

  const code = options.dev ? options.devCode : generateCode(channel.digits)
  const now = new Date()

  await db.insert(otpCodes).values({
    [channel.field]: target,
    codeHash: hashOtp(target, code),
    ip,
    expiresAt: new Date(now.getTime() + channel.ttlMs),
    // время из JS, а не из БД: лимиты считаются по тем же часам, что и выдача кода
    createdAt: now,
    updatedAt: now,
  })

  if (!options.dev) await options.deliver(code)
  return 'ok'
}

/** Запрашивает код по телефону: проверяет лимиты, пишет хэш в БД и отправляет СМС. */
export async function requestOtp(phone: string, ip: string): Promise<RequestOtpResult> {
  const result = await issueCode(PHONE_CHANNEL, phone, ip, {
    dev: isDevPhone(phone),
    devCode: DEV_CODE,
    deliver: (code) => getSmsProvider().send(phone, otpText(code)),
  })
  if (result === 'ok') return { ok: true }
  return { ok: false, reason: result === 'rate_target' ? 'rate_phone' : 'rate_ip' }
}

/** Тема и текст письма с кодом. Код — отдельным числом: его удобно выделить и скопировать. */
export function emailOtpMessage(code: string): { subject: string; text: string; html: string } {
  return {
    subject: `Код входа МаксИИм: ${code}`,
    text: `Код входа МаксИИм: ${code}\n\nОн действует 10 минут. Никому его не сообщай.\nЕсли это не ты — просто проигнорируй письмо.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px"><p style="margin:0 0 12px">Код входа МаксИИм:</p><p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p><p style="margin:0 0 8px;color:#555">Он действует 10 минут. Никому его не сообщай.</p><p style="margin:0;color:#888;font-size:13px">Если это не ты — просто проигнорируй письмо.</p></div>`,
  }
}

/** Запрашивает код по почте: те же лимиты, письмо уходит через провайдера `EMAIL_PROVIDER`. */
export async function requestEmailOtp(email: string, ip: string): Promise<RequestEmailOtpResult> {
  const result = await issueCode(EMAIL_CHANNEL, email, ip, {
    dev: isDevEmail(email),
    devCode: DEV_EMAIL_CODE,
    deliver: (code) => getEmailProvider().send(email, emailOtpMessage(code)),
  })
  if (result === 'ok') return { ok: true }
  return { ok: false, reason: result === 'rate_target' ? 'rate_email' : 'rate_ip' }
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Неверные вводы по номеру за последние сутки (успешный ввод тоже тратит попытку — вычитаем его). */
async function failedAttemptsLastDay(channel: Channel, target: string, now: Date): Promise<number> {
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const [row] = await db
    .select({
      failed: sql<number>`coalesce(sum(${otpCodes.attempts}), 0)::int - count(${otpCodes.consumedAt})::int`,
    })
    .from(otpCodes)
    .where(and(eq(channel.column, target), gte(otpCodes.createdAt, dayAgo)))
  return row?.failed ?? 0
}

/**
 * Проверяет код (срок — по каналу), не больше 5 попыток на код и 10 неверных вводов на адрес в сутки,
 * один раз. Попытка «забирается» атомарным UPDATE до сравнения — параллельные запросы
 * не могут обойти лимит (ревью F2).
 */
async function checkCode(channel: Channel, target: string, code: string): Promise<VerifyOtpResult> {
  const now = new Date()

  if ((await failedAttemptsLastDay(channel, target, now)) >= OTP_MAX_FAILED_PER_DAY) {
    return { ok: false, reason: 'locked_day' }
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(channel.column, target), isNull(otpCodes.consumedAt)))
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

  if (!hashesEqual(row.codeHash, hashOtp(target, code))) {
    return { ok: false, reason: 'invalid' }
  }

  const [consumed] = await db
    .update(otpCodes)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id })

  return consumed ? { ok: true } : { ok: false, reason: 'invalid' }
}

/** Проверяет код из СМС. */
export function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  return checkCode(PHONE_CHANNEL, phone, code)
}

/** Проверяет код из письма. */
export function verifyEmailOtp(email: string, code: string): Promise<VerifyOtpResult> {
  return checkCode(EMAIL_CHANNEL, email, code)
}
