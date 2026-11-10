import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { otpCodes } from './schema'
import { requestEmailOtp, requestOtp, verifyEmailOtp, verifyOtp } from './otp'
import type { EmailMessage } from './mail'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const NOW = new Date('2026-11-10T09:00:00.000Z')

const sendEmail = vi.fn<(to: string, message: EmailMessage) => Promise<void>>(async () => {})
const sendSms = vi.fn<(phone: string, text: string) => Promise<void>>(async () => {})

vi.mock('./mail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mail')>()),
  getEmailProvider: () => ({ send: sendEmail }),
}))
vi.mock('./sms', () => ({ getSmsProvider: () => ({ send: sendSms }) }))

const EMAIL = 'client@example.com'
const DEV_EMAIL = 'qa@dev.maxosipov.test'

function advance(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms))
}

function lastCode(): string {
  const call = sendEmail.mock.calls.at(-1)
  const match = /\b(\d{6})\b/.exec(call?.[1].text ?? '')
  if (!match?.[1]) throw new Error('в письме нет шестизначного кода')
  return match[1]
}

beforeAll(async () => {
  await prepareTestDb()
})
afterEach(() => {
  vi.useRealTimers()
})
afterAll(async () => {
  await closeDb()
})
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  sendEmail.mockClear()
  sendSms.mockClear()
  await resetDb()
})

test('шлёт письмо с шестизначным кодом и хранит только хэш', async () => {
  expect(await requestEmailOtp(EMAIL, '1.1.1.1')).toEqual({ ok: true })

  expect(sendEmail).toHaveBeenCalledOnce()
  const [to, message] = sendEmail.mock.calls[0] ?? []
  expect(to).toBe(EMAIL)
  expect(message?.subject).toContain('МаксИИм')
  expect(message?.text).toContain('10 минут')
  const code = lastCode()

  const rows = await db.select().from(otpCodes).where(eq(otpCodes.email, EMAIL))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.phone).toBeNull()
  expect(rows[0]?.codeHash).not.toContain(code)
  expect(rows[0]?.codeHash).toMatch(/^[0-9a-f]{64}$/)
})

test('верный код подходит один раз', async () => {
  await requestEmailOtp(EMAIL, '1.1.1.1')
  const code = lastCode()
  expect(await verifyEmailOtp(EMAIL, code)).toEqual({ ok: true })
  expect(await verifyEmailOtp(EMAIL, code)).toEqual({ ok: false, reason: 'invalid' })
})

test('неверный код — invalid; чужая почта код не открывает', async () => {
  await requestEmailOtp(EMAIL, '1.1.1.1')
  const code = lastCode()
  expect(await verifyEmailOtp(EMAIL, code === '000000' ? '000001' : '000000')).toEqual({ ok: false, reason: 'invalid' })
  expect(await verifyEmailOtp('other@example.com', code)).toEqual({ ok: false, reason: 'invalid' })
})

test('код живёт 10 минут', async () => {
  await requestEmailOtp(EMAIL, '1.1.1.1')
  const code = lastCode()
  advance(10 * MINUTE + 1000)
  expect(await verifyEmailOtp(EMAIL, code)).toEqual({ ok: false, reason: 'expired' })
})

test('не больше 3 запросов в час на почту и 20 на IP', async () => {
  for (let i = 0; i < 3; i += 1) expect(await requestEmailOtp(EMAIL, `10.0.0.${i}`)).toEqual({ ok: true })
  expect(await requestEmailOtp(EMAIL, '10.0.0.9')).toEqual({ ok: false, reason: 'rate_email' })
  advance(HOUR + 1000)
  expect(await requestEmailOtp(EMAIL, '10.0.0.9')).toEqual({ ok: true })

  for (let i = 0; i < 20; i += 1) await requestEmailOtp(`user${i}@example.com`, '9.9.9.9')
  expect(await requestEmailOtp('last@example.com', '9.9.9.9')).toEqual({ ok: false, reason: 'rate_ip' })
})

test('5 попыток на код, потом too_many_attempts даже с верным кодом', async () => {
  await requestEmailOtp(EMAIL, '1.1.1.1')
  const code = lastCode()
  const wrong = code === '123456' ? '654321' : '123456'
  for (let i = 0; i < 5; i += 1) await verifyEmailOtp(EMAIL, wrong)
  expect(await verifyEmailOtp(EMAIL, code)).toEqual({ ok: false, reason: 'too_many_attempts' })
})

test('10 неверных вводов за сутки блокируют почту', async () => {
  for (let round = 0; round < 3; round += 1) {
    await requestEmailOtp(EMAIL, '1.1.1.1')
    const code = lastCode()
    const wrong = code === '123456' ? '654321' : '123456'
    for (let i = 0; i < 4; i += 1) await verifyEmailOtp(EMAIL, wrong)
    advance(20 * MINUTE)
  }
  await requestEmailOtp(EMAIL, '1.1.1.1')
  expect(await verifyEmailOtp(EMAIL, lastCode())).toEqual({ ok: false, reason: 'locked_day' })
})

test('тестовая почта *@dev.maxosipov.test: код 111111, письмо не уходит (не в production)', async () => {
  for (let i = 0; i < 5; i += 1) expect(await requestEmailOtp(DEV_EMAIL, '1.1.1.1')).toEqual({ ok: true })
  expect(sendEmail).not.toHaveBeenCalled()
  expect(await verifyEmailOtp(DEV_EMAIL, '111111')).toEqual({ ok: true })
})

test('ошибка провайдера пробрасывается: человек увидит «не получилось отправить»', async () => {
  sendEmail.mockRejectedValueOnce(new Error('SMTP.bz отклонил письмо'))
  await expect(requestEmailOtp(EMAIL, '1.1.1.1')).rejects.toThrow(/SMTP\.bz/)
})

test('коды по телефону и по почте не пересекаются', async () => {
  await requestOtp('+79991234567', '1.1.1.1')
  expect(sendSms).toHaveBeenCalledOnce()
  expect(sendEmail).not.toHaveBeenCalled()
  expect(await verifyOtp('+79991234567', '0000')).toEqual({ ok: false, reason: 'invalid' })
  expect(await verifyEmailOtp(EMAIL, '000000')).toEqual({ ok: false, reason: 'invalid' })
})
