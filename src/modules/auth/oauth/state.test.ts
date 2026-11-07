import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { openState, sealState, type OAuthState } from './state'

const MINUTE = 60 * 1000
const NOW = new Date('2026-11-07T09:00:00.000Z')

const data: OAuthState = {
  provider: 'yandex',
  verifier: 'verifier-123',
  state: 'state-456',
  createdAt: NOW.getTime(),
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

test('open(seal(x)) возвращает исходные данные', () => {
  expect(openState(sealState(data))).toEqual(data)
})

test('подделанная подпись → null', () => {
  const sealed = sealState(data)
  const tampered = `${sealed.slice(0, -2)}xx`
  expect(openState(tampered)).toBeNull()
})

test('подменённые данные без пересчёта подписи → null', () => {
  const sealed = sealState(data)
  const [, signature] = sealed.split('.')
  const forgedPayload = Buffer.from(
    JSON.stringify({ ...data, verifier: 'чужой-verifier' }),
    'utf-8',
  ).toString('base64url')

  expect(openState(`${forgedPayload}.${signature}`)).toBeNull()
})

test('старше 10 минут → null', () => {
  const sealed = sealState(data)
  vi.setSystemTime(new Date(NOW.getTime() + 10 * MINUTE + 1000))
  expect(openState(sealed)).toBeNull()
})

test('мусор вместо токена → null', () => {
  expect(openState('не-токен')).toBeNull()
  expect(openState('')).toBeNull()
})
