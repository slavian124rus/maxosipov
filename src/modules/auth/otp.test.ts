import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { otpCodes } from './schema'
import { requestOtp, verifyOtp } from './otp'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const NOW = new Date('2026-11-07T09:00:00.000Z')

const send = vi.fn<(phone: string, text: string) => Promise<void>>(async () => {})

vi.mock('./sms', () => ({
  getSmsProvider: () => ({ send }),
}))

const REAL_PHONE = '+79991234567'
const DEV_PHONE = '+79990000099'

function advance(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms))
}

function codeFromSms(text: string): string {
  const match = /^Код входа МаксИИм: (\d{4})\. Никому его не сообщай\.$/.exec(text)
  if (!match?.[1]) throw new Error(`неожиданный текст СМС: ${text}`)
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
  send.mockClear()
  await resetDb()
})

test('отправляет код провайдеру и хранит только хэш', async () => {
  const result = await requestOtp(REAL_PHONE, '10.0.0.1')
  expect(result).toEqual({ ok: true })

  expect(send).toHaveBeenCalledTimes(1)
  const [phoneArg, textArg] = send.mock.calls[0]!
  expect(phoneArg).toBe(REAL_PHONE)
  const code = codeFromSms(textArg)

  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, REAL_PHONE))
  expect(row?.codeHash).not.toBe(code)
  expect(row?.codeHash).toHaveLength(64)
})

test('верный код подтверждает, повторное использование того же кода — нет', async () => {
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])

  expect(await verifyOtp(REAL_PHONE, code)).toEqual({ ok: true })
  expect(await verifyOtp(REAL_PHONE, code)).toEqual({ ok: false, reason: 'invalid' })
})

test('после 5 неверных попыток даже верный код не принимается', async () => {
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])

  for (let i = 0; i < 5; i += 1) {
    expect(await verifyOtp(REAL_PHONE, '0000')).toEqual({ ok: false, reason: 'invalid' })
  }

  expect(await verifyOtp(REAL_PHONE, code)).toEqual({ ok: false, reason: 'too_many_attempts' })
})

test('через 5 минут 1 секунду код устарел', async () => {
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])

  advance(5 * MINUTE + 1000)
  expect(await verifyOtp(REAL_PHONE, code)).toEqual({ ok: false, reason: 'expired' })
})

test('не больше 3 запросов кода на номер в час', async () => {
  expect(await requestOtp(REAL_PHONE, '10.0.0.1')).toEqual({ ok: true })
  advance(MINUTE)
  expect(await requestOtp(REAL_PHONE, '10.0.0.1')).toEqual({ ok: true })
  advance(MINUTE)
  expect(await requestOtp(REAL_PHONE, '10.0.0.1')).toEqual({ ok: true })
  advance(MINUTE)
  expect(await requestOtp(REAL_PHONE, '10.0.0.1')).toEqual({ ok: false, reason: 'rate_phone' })

  advance(HOUR)
  expect(await requestOtp(REAL_PHONE, '10.0.0.1')).toEqual({ ok: true })
})

test('не больше 20 запросов кода с одного IP в час', async () => {
  for (let i = 0; i < 20; i += 1) {
    const phone = `+7999123${String(1000 + i)}`
    expect(await requestOtp(phone, '10.0.0.2')).toEqual({ ok: true })
  }

  expect(await requestOtp('+79991239999', '10.0.0.2')).toEqual({ ok: false, reason: 'rate_ip' })
})

test('в dev для тестового номера код 1111 и СМС не отправляется', async () => {
  expect(await requestOtp(DEV_PHONE, '10.0.0.3')).toEqual({ ok: true })
  expect(send).not.toHaveBeenCalled()

  expect(await verifyOtp(DEV_PHONE, '1111')).toEqual({ ok: true })
})

test('20 параллельных неверных вводов: проверено ровно 5, остальные отклонены лимитом', async () => {
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])
  const wrong = code === '0000' ? '0001' : '0000'

  const results = await Promise.all(
    Array.from({ length: 20 }, () => verifyOtp(REAL_PHONE, wrong)),
  )

  const invalid = results.filter((r) => !r.ok && r.reason === 'invalid').length
  const limited = results.filter((r) => !r.ok && r.reason === 'too_many_attempts').length
  expect(invalid).toBe(5)
  expect(limited).toBe(15)

  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, REAL_PHONE))
  expect(row?.attempts).toBe(5)
})

test('два параллельных ввода верного кода: вход только один', async () => {
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])

  const results = await Promise.all([verifyOtp(REAL_PHONE, code), verifyOtp(REAL_PHONE, code)])
  expect(results.filter((r) => r.ok)).toHaveLength(1)
})

test('больше 10 неверных вводов за сутки — номер блокируется до завтра', async () => {
  for (let round = 0; round < 3; round += 1) {
    send.mockClear()
    await requestOtp(REAL_PHONE, '10.0.0.1')
    const code = codeFromSms(send.mock.calls[0]![1])
    const wrong = code === '0000' ? '0001' : '0000'
    const attempts = round < 2 ? 5 : 1
    for (let i = 0; i < attempts; i += 1) await verifyOtp(REAL_PHONE, wrong)
    advance(HOUR + MINUTE) // обходим лимит «3 запроса в час»
  }

  // 11 неверных вводов за ~3 часа
  send.mockClear()
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const code = codeFromSms(send.mock.calls[0]![1])
  expect(await verifyOtp(REAL_PHONE, code)).toEqual({ ok: false, reason: 'locked_day' })

  advance(24 * HOUR)
  send.mockClear()
  await requestOtp(REAL_PHONE, '10.0.0.1')
  const fresh = codeFromSms(send.mock.calls[0]![1])
  expect(await verifyOtp(REAL_PHONE, fresh)).toEqual({ ok: true })
})
