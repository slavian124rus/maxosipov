import { expect, test } from 'vitest'
import { addMonthsClamped } from './dates'

const TZ = 'Asia/Krasnoyarsk'

function at(iso: string): Date {
  return new Date(iso)
}

test.each([
  ['2027-01-31T12:00:00+07:00', 1, '2027-02-28T12:00:00+07:00'],
  ['2028-01-31T12:00:00+07:00', 1, '2028-02-29T12:00:00+07:00'],
  ['2026-11-07T12:00:00+07:00', 3, '2027-02-07T12:00:00+07:00'],
  ['2026-12-15T12:00:00+07:00', 12, '2027-12-15T12:00:00+07:00'],
  ['2026-03-31T09:30:00+07:00', 1, '2026-04-30T09:30:00+07:00'],
])('%s + %i мес → %s', (from, months, to) => {
  expect(addMonthsClamped(at(from), months, TZ).toISOString()).toBe(at(to).toISOString())
})

test('часовой пояс зала не сдвигает дату', () => {
  // 2026-12-31T20:00Z — это уже 1 января 03:00 по Красноярску
  const result = addMonthsClamped(new Date('2026-12-31T20:00:00Z'), 1, TZ)
  expect(result.toISOString()).toBe(new Date('2027-01-31T20:00:00Z').toISOString())
})
