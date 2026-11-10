import { expect, test } from 'vitest'
import { parseEnv } from './env'

const base = {
  DATABASE_URL: 'postgres://a:b@localhost:5432/c',
  AUTH_SECRET: 'x'.repeat(32),
  MEDIA_URL_SIGNING_SECRET: 'y'.repeat(24),
}

test('throws a readable error when DATABASE_URL is missing', () => {
  expect(() => parseEnv({ AUTH_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/)
})

test('accepts minimal valid env', () => {
  const e = parseEnv(base)
  expect(e.APP_URL).toBe('http://app.localhost:3000')
  expect(e.SITE_URL).toBe('http://localhost:3000')
  expect(e.MEDIA_ROOT).toBe('/data/media')
})

test('SMS_PROVIDER по умолчанию console', () => {
  expect(parseEnv(base).SMS_PROVIDER).toBe('console')
})

test('MEDIA_URL_SIGNING_SECRET обязателен и не короче 16 символов', () => {
  expect(() =>
    parseEnv({ DATABASE_URL: base.DATABASE_URL, AUTH_SECRET: base.AUTH_SECRET }),
  ).toThrow(/MEDIA_URL_SIGNING_SECRET/)

  expect(() => parseEnv({ ...base, MEDIA_URL_SIGNING_SECRET: 'short' })).toThrow(
    /MEDIA_URL_SIGNING_SECRET/,
  )
})

test('smsru без SMS_API_KEY — ошибка', () => {
  expect(() => parseEnv({ ...base, SMS_PROVIDER: 'smsru' })).toThrow(/SMS_API_KEY/)
})

test('smsaero без SMS_AERO_LOGIN — ошибка, с ключом и логином — ок', () => {
  expect(() => parseEnv({ ...base, SMS_PROVIDER: 'smsaero', SMS_API_KEY: 'k' })).toThrow(/SMS_AERO_LOGIN/)
  expect(() => parseEnv({ ...base, SMS_PROVIDER: 'smsaero', SMS_AERO_LOGIN: 'a@b.ru' })).toThrow(/SMS_API_KEY/)
  expect(
    parseEnv({ ...base, SMS_PROVIDER: 'smsaero', SMS_API_KEY: 'k', SMS_AERO_LOGIN: 'a@b.ru' }).SMS_PROVIDER,
  ).toBe('smsaero')
})

test('missingAiEnv: перечисляет незаполненные переменные МаксИИма', async () => {
  const { missingAiEnv } = await import('./env')
  expect(missingAiEnv({})).toEqual([
    'AI_API_KEY',
    'AI_MODEL_MAIN',
    'AI_MODEL_FAST',
    'AI_MODEL_FALLBACK',
    'STT_PROVIDER',
  ])
  expect(
    missingAiEnv({
      AI_API_KEY: 'k',
      AI_MODEL_MAIN: 'a',
      AI_MODEL_FAST: 'b',
      AI_MODEL_FALLBACK: 'c',
      STT_PROVIDER: 'yandex',
    }),
  ).toEqual(['YANDEX_SPEECHKIT_KEY'])
})
