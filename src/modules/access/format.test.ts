import { expect, test } from 'vitest'
import { accessPreviewLabel, formatDayRu, grantPreviewLabel } from './format'

const TZ = 'Asia/Krasnoyarsk'
const NOW = new Date('2026-11-12T05:00:00Z') // 12:00 по Красноярску

test('formatDayRu: «5 января 2027» без хвоста «г.»', () => {
  expect(formatDayRu(new Date('2027-01-05T05:00:00Z'), TZ)).toBe('5 января 2027')
  expect(formatDayRu(new Date('2026-12-31T20:00:00Z'), TZ)).toBe('1 января 2027')
})

test('grantPreviewLabel: продлеваем от конца действующей подписки', () => {
  const access = {
    hasAccess: true,
    status: 'active' as const,
    endsAt: new Date('2026-12-05T05:00:00Z'),
  }

  expect(grantPreviewLabel(access, 1, TZ, NOW)).toBe('5 января 2027')
  expect(grantPreviewLabel(access, 3, TZ, NOW)).toBe('5 марта 2027')
})

test('grantPreviewLabel: без доступа — от сегодня', () => {
  const access = { hasAccess: false, status: 'none' as const, endsAt: null }

  expect(grantPreviewLabel(access, 1, TZ, NOW)).toBe('12 декабря 2026')
})

test('grantPreviewLabel: замороженную не обещаем точной датой', () => {
  const access = {
    hasAccess: false,
    status: 'frozen' as const,
    endsAt: new Date('2026-12-05T05:00:00Z'),
  }

  expect(grantPreviewLabel(access, 1, TZ, NOW)).toBe('дата сдвинется после разморозки')
})

test('grantPreviewLabel: конец месяца не перескакивает', () => {
  const access = {
    hasAccess: true,
    status: 'active' as const,
    endsAt: new Date('2027-01-31T05:00:00Z'),
  }

  // 31 января + 1 месяц = 28 февраля (не 3 марта).
  expect(grantPreviewLabel(access, 1, TZ, NOW)).toBe('28 февраля 2027')
})

test('accessPreviewLabel: текущее состояние словами', () => {
  expect(
    accessPreviewLabel(
      { hasAccess: true, status: 'trial', endsAt: new Date('2026-12-05T05:00:00Z') },
      TZ,
    ),
  ).toBe('сейчас до 5 декабря 2026')

  expect(accessPreviewLabel({ hasAccess: false, status: 'none', endsAt: null }, TZ)).toBe(
    'доступа нет',
  )
  expect(
    accessPreviewLabel(
      { hasAccess: false, status: 'frozen', endsAt: new Date('2026-12-05T05:00:00Z') },
      TZ,
    ),
  ).toBe('подписка заморожена')
})
