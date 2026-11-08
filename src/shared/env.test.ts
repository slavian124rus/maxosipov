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
