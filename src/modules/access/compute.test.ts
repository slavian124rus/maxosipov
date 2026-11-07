import { expect, test } from 'vitest'
import { computeAccess, type SubscriptionRow } from './compute'

const NOW = new Date('2026-11-07T09:00:00Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function sub(status: SubscriptionRow['status'], endsAt: Date): SubscriptionRow {
  return {
    id: 's1',
    userId: 'u1',
    status,
    startsAt: new Date(NOW.getTime() - 30 * DAY),
    endsAt,
    frozenAt: null,
    statusBeforeFreeze: null,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

test('нет подписки', () => {
  expect(computeAccess(null, NOW)).toEqual({
    hasAccess: false,
    status: 'none',
    endsAt: null,
    daysLeft: null,
  })
})

test('пробный период: 3 дня 2 часа → 4 дня вверх', () => {
  const access = computeAccess(sub('trial', new Date(NOW.getTime() + 3 * DAY + 2 * HOUR)), NOW)
  expect(access.hasAccess).toBe(true)
  expect(access.daysLeft).toBe(4)
  expect(access.status).toBe('trial')
})

test('active с прошедшим концом — доступа нет', () => {
  const access = computeAccess(sub('active', new Date(NOW.getTime() - HOUR)), NOW)
  expect(access.hasAccess).toBe(false)
})

test('замороженная и отключённая подписка — доступа нет', () => {
  expect(computeAccess(sub('frozen', new Date(NOW.getTime() + 10 * DAY)), NOW).hasAccess).toBe(false)
  expect(computeAccess(sub('disabled', new Date(NOW.getTime() + 10 * DAY)), NOW).hasAccess).toBe(
    false,
  )
})

test('истёкшая подписка — доступа нет', () => {
  const access = computeAccess(sub('expired', new Date(NOW.getTime() - 3 * DAY)), NOW)
  expect(access.hasAccess).toBe(false)
  expect(access.status).toBe('expired')
})
