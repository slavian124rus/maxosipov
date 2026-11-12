// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { STALE_SESSION_MS } from '@/lib/offline/use-active-session'
import { resumeDayId, TodayWorkoutCard } from './today-workout-card'

const device = vi.hoisted(() => ({
  session: null as { programDayId: string | null; startedAt: string } | null,
}))

vi.mock('@/lib/offline/queue', () => ({
  findActiveSession: async () => device.session,
}))

const DAYS = [
  { id: 'day-1', name: 'День 1 — ноги', exercises: 5 },
  { id: 'day-2', name: 'День 2 — спина', exercises: 4 },
  { id: 'day-3', name: 'День 3 — грудь', exercises: 6 },
]

const NOW = new Date('2026-11-12T10:00:00.000Z').getTime()

function fresh(dayId: string): { programDayId: string; startedAt: string } {
  return { programDayId: dayId, startedAt: new Date().toISOString() }
}

afterEach(() => {
  cleanup()
  device.session = null
})

test('resumeDayId: свежая незавершённая тренировка — её день', () => {
  expect(
    resumeDayId(DAYS, { programDayId: 'day-2', startedAt: new Date(NOW - 60_000).toISOString() }, NOW),
  ).toBe('day-2')
})

test('resumeDayId: старая тренировка и чужой день не считаются', () => {
  expect(
    resumeDayId(
      DAYS,
      { programDayId: 'day-2', startedAt: new Date(NOW - STALE_SESSION_MS - 1000).toISOString() },
      NOW,
    ),
  ).toBeNull()
  expect(
    resumeDayId(DAYS, { programDayId: 'day-9', startedAt: new Date(NOW).toISOString() }, NOW),
  ).toBeNull()
  expect(resumeDayId(DAYS, null, NOW)).toBeNull()
})

test('ничего не начато — «Начать тренировку» для рекомендованного дня', async () => {
  render(<TodayWorkoutCard days={DAYS} recommendedId="day-1" />)

  expect(screen.getByText('Сегодня')).toBeTruthy()
  expect(screen.getByText('День 1 — ноги')).toBeTruthy()
  const cta = screen.getByRole('link', { name: 'Начать тренировку' })
  expect(cta.getAttribute('href')).toBe('/workout?day=day-1')
  expect(screen.queryByText('Продолжить тренировку')).toBeNull()

  // Пока IndexedDB не ответил — карточка уже показывает рекомендованный день.
  await waitFor(() => expect(screen.queryByText('Продолжить тренировку')).toBeNull())
})

test('сервер знает о начатой тренировке — только «Продолжить» для её дня', () => {
  render(<TodayWorkoutCard days={DAYS} recommendedId="day-1" ongoingDayId="day-2" />)

  expect(screen.getByText('Начата тренировка')).toBeTruthy()
  expect(screen.getByText('День 2 — спина')).toBeTruthy()
  expect(screen.getByText('Подходы уже записаны — продолжай с того же места')).toBeTruthy()

  const cta = screen.getByRole('link', { name: 'Продолжить тренировку' })
  expect(cta.getAttribute('href')).toBe('/workout?day=day-2')
  // Кнопки «Начать» нет — иначе клиент закрыл бы свою же тренировку.
  expect(screen.queryByText('Начать тренировку')).toBeNull()
})

test('старт ещё не ушёл на сервер, но память устройства знает день — «Продолжить»', async () => {
  device.session = fresh('day-3')

  render(<TodayWorkoutCard days={DAYS} recommendedId="day-1" />)

  const cta = await screen.findByRole('link', { name: 'Продолжить тренировку' })
  expect(cta.getAttribute('href')).toBe('/workout?day=day-3')
  expect(screen.getByText('День 3 — грудь')).toBeTruthy()
  expect(screen.queryByText('Начать тренировку')).toBeNull()
})

test('старая тренировка из памяти устройства не мешает начать новую', async () => {
  device.session = {
    programDayId: 'day-2',
    // Считаем от настоящего времени: компонент берёт Date.now(), а не тестовую константу.
    startedAt: new Date(Date.now() - STALE_SESSION_MS - 60_000).toISOString(),
  }

  render(<TodayWorkoutCard days={DAYS} recommendedId="day-1" />)

  await waitFor(() => expect(screen.getByText('Начать тренировку')).toBeTruthy())
  expect(screen.queryByText('Продолжить тренировку')).toBeNull()
})

test('в окне выбора дня начатый день помечен «идёт сейчас»', () => {
  render(<TodayWorkoutCard days={DAYS} recommendedId="day-1" ongoingDayId="day-2" />)

  expect(screen.queryByText('идёт сейчас')).toBeNull()
  expect(screen.getByRole('button', { name: /Сменить день/ })).toBeTruthy()
})

test('один день в программе — выбора дня нет', () => {
  render(<TodayWorkoutCard days={[DAYS[0]!]} recommendedId="day-1" />)

  expect(screen.queryByRole('button', { name: /Сменить день/ })).toBeNull()
  expect(screen.getByRole('link', { name: 'Начать тренировку' })).toBeTruthy()
})
