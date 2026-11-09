import { expect, test } from 'vitest'
import { dayKey, formatLongDate, formatShortDate, mondayKey, minutesBetween } from './dates'

const KRAT = 'Asia/Krasnoyarsk'

test('dayKey: полночь по Красноярску и UTC дают разные дни', () => {
  const moment = new Date('2026-11-01T20:00:00Z')

  expect(dayKey(moment, KRAT)).toBe('2026-11-02')
  expect(dayKey(moment, 'UTC')).toBe('2026-11-01')
})

test('mondayKey: понедельник недели в часовом поясе зала', () => {
  // 2 ноября 2026 — понедельник
  expect(mondayKey(new Date('2026-11-05T10:00:00Z'), KRAT)).toBe('2026-11-02')
  // воскресенье 1 ноября по UTC, но уже понедельник 2 ноября по Красноярску
  expect(mondayKey(new Date('2026-11-01T20:00:00Z'), KRAT)).toBe('2026-11-02')
  expect(mondayKey(new Date('2026-11-01T20:00:00Z'), 'UTC')).toBe('2026-10-26')
})

test('formatShortDate: «7 нояб»', () => {
  expect(formatShortDate(new Date('2026-11-07T10:00:00Z'), KRAT)).toBe('7 нояб')
})

test('formatLongDate: сегодня / вчера / дата с годом', () => {
  const now = new Date('2026-11-07T10:00:00Z')

  expect(formatLongDate(new Date('2026-11-07T05:00:00Z'), KRAT, now)).toBe('сегодня')
  expect(formatLongDate(new Date('2026-11-06T05:00:00Z'), KRAT, now)).toBe('вчера')
  expect(formatLongDate(new Date('2026-11-01T05:00:00Z'), KRAT, now)).toBe('1 ноября')
  expect(formatLongDate(new Date('2025-12-15T05:00:00Z'), KRAT, now)).toBe('15 декабря 2025')
})

test('formatLongDate: граница суток по часовому поясу зала', () => {
  // 2026-11-06T18:00Z — это 7 ноября 01:00 по Красноярску, то есть «сегодня»
  const now = new Date('2026-11-07T10:00:00Z')
  expect(formatLongDate(new Date('2026-11-06T18:00:00Z'), KRAT, now)).toBe('сегодня')
  expect(formatLongDate(new Date('2026-11-06T18:00:00Z'), 'UTC', now)).toBe('вчера')
})

test('minutesBetween считает минуты и не отдаёт ноль', () => {
  expect(minutesBetween(new Date('2026-11-07T09:00:00Z'), new Date('2026-11-07T09:54:00Z'))).toBe(54)
  expect(minutesBetween(new Date('2026-11-07T09:00:00Z'), new Date('2026-11-07T09:00:10Z'))).toBe(1)
})
