// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DayPicker } from './day-picker'

// Диалоги Radix портируют содержимое в body — подменяем простым условием по `open`.
const dialog = vi.hoisted(() => ({ open: false }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div role="dialog">{children}</div> : null,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const DAYS = [
  { id: 'day-1', name: 'День 1 — ноги', exercises: 5 },
  { id: 'day-2', name: 'День 2 — спина', exercises: 1 },
  { id: 'day-3', name: 'День 3 — грудь', exercises: 0 },
]

beforeEach(() => {
  dialog.open = false
})

afterEach(() => {
  cleanup()
})

test('до нажатия окно закрыто', () => {
  render(<DayPicker days={DAYS} recommendedId="day-1" />)

  expect(screen.getByRole('button', { name: /Сменить день/ })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('в окне все дни со счётчиком упражнений и отметкой «рекомендуем»', () => {
  render(<DayPicker days={DAYS} recommendedId="day-2" />)

  fireEvent.click(screen.getByRole('button', { name: /Сменить день/ }))

  const box = screen.getByRole('dialog')
  expect(box.textContent).toContain('Выбери день')
  expect(box.textContent).toContain('День 1 — ноги')
  expect(box.textContent).toContain('5 упражнений')
  expect(box.textContent).toContain('1 упражнение')
  expect(box.textContent).toContain('0 упражнений')
  // Отметка ровно одна — у рекомендованного дня.
  expect(box.textContent?.match(/рекомендуем/g)).toHaveLength(1)
})

test('каждый день ведёт на тренировку с этим днём', () => {
  render(<DayPicker days={DAYS} recommendedId="day-1" />)

  fireEvent.click(screen.getByRole('button', { name: /Сменить день/ }))

  const links = screen.getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/workout?day=day-1',
    '/workout?day=day-2',
    '/workout?day=day-3',
  ])
})

test('предупреждаем, что начатая тренировка завершится', () => {
  render(<DayPicker days={DAYS} recommendedId="day-1" />)

  fireEvent.click(screen.getByRole('button', { name: /Сменить день/ }))

  expect(screen.getByText(/она завершится при выборе другого дня/)).toBeTruthy()
})

test('один день в программе — подпись в единственном числе', () => {
  render(<DayPicker days={[DAYS[0]!]} recommendedId="day-1" />)

  fireEvent.click(screen.getByRole('button', { name: /Сменить день/ }))

  expect(screen.getByText('В программе один день — можно выбрать его')).toBeTruthy()
})
