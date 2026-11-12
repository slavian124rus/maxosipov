// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { STALE_SESSION_MS } from '@/lib/offline/use-active-session'
import { ResumeHint, resumeDayId } from './resume-hint'

const session = vi.hoisted(() => ({ value: null as { programDayId: string | null; startedAt: string } | null }))

vi.mock('@/lib/offline/queue', () => ({
  findActiveSession: async () => session.value,
}))

const DAYS = [
  { id: 'day-1', name: 'День 1 — ноги' },
  { id: 'day-2', name: 'День 2 — спина' },
]

const NOW = new Date('2026-11-12T10:00:00.000Z').getTime()

afterEach(() => {
  cleanup()
  session.value = null
})

test('resumeDayId: свежая незавершённая тренировка — её день', () => {
  expect(
    resumeDayId(DAYS, { programDayId: 'day-2', startedAt: new Date(NOW - 60_000).toISOString() }, NOW),
  ).toBe('day-2')
})

test('resumeDayId: старая тренировка не считается', () => {
  expect(
    resumeDayId(
      DAYS,
      { programDayId: 'day-2', startedAt: new Date(NOW - STALE_SESSION_MS - 1000).toISOString() },
      NOW,
    ),
  ).toBeNull()
})

test('resumeDayId: день из прошлой программы игнорируется', () => {
  expect(
    resumeDayId(DAYS, { programDayId: 'day-9', startedAt: new Date(NOW).toISOString() }, NOW),
  ).toBeNull()
})

test('resumeDayId: без дня и без сессии — ничего', () => {
  expect(resumeDayId(DAYS, null, NOW)).toBeNull()
  expect(
    resumeDayId(DAYS, { programDayId: null, startedAt: new Date(NOW).toISOString() }, NOW),
  ).toBeNull()
})

test('компонент показывает «Продолжить» со ссылкой на этот день', async () => {
  session.value = { programDayId: 'day-2', startedAt: new Date().toISOString() }

  render(<ResumeHint days={DAYS} />)

  const link = await screen.findByRole('link', { name: 'Продолжить: День 2 — спина' })
  expect(link.getAttribute('href')).toBe('/workout?day=day-2')
})

test('компонент молчит, если начатой тренировки нет', async () => {
  render(<ResumeHint days={DAYS} />)

  await waitFor(() => expect(screen.queryByRole('link')).toBeNull())
})
