import { expect, test } from 'vitest'
import { parseEnv } from './env'

test('throws a readable error when DATABASE_URL is missing', () => {
  expect(() => parseEnv({ AUTH_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/)
})

test('accepts minimal valid env', () => {
  const e = parseEnv({ DATABASE_URL: 'postgres://a:b@localhost:5432/c', AUTH_SECRET: 'x'.repeat(32) })
  expect(e.APP_URL).toBe('http://app.localhost:3000')
  expect(e.SITE_URL).toBe('http://localhost:3000')
})

test('SMS_PROVIDER по умолчанию console', () => {
  const e = parseEnv({ DATABASE_URL: 'postgres://a:b@localhost:5432/c', AUTH_SECRET: 'x'.repeat(32) })
  expect(e.SMS_PROVIDER).toBe('console')
})

test('smsru без SMS_API_KEY — ошибка', () => {
  expect(() =>
    parseEnv({
      DATABASE_URL: 'postgres://a:b@localhost:5432/c',
      AUTH_SECRET: 'x'.repeat(32),
      SMS_PROVIDER: 'smsru',
    }),
  ).toThrow(/SMS_API_KEY/)
})
