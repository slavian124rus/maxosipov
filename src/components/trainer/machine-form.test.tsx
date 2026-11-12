// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { MachineListItem } from '@/modules/catalog'
import { MachineForm } from './machine-form'

// Серверные действия в jsdom не выполняются — подменяем их заглушками.
// `deleteError` позволяет проверить отказ сервера (например, упражнения привязали в другой вкладке).
const server = vi.hoisted(() => ({ deleteError: null as string | null }))

vi.mock('@/app/(app)/app/trainer/exercises/actions', () => ({
  saveMachineAction: async () => ({ error: null, ok: false, id: null }),
  deleteMachineAction: async () => ({
    error: server.deleteError,
    ok: false,
    id: null,
  }),
}))

// Диалог подтверждения: содержимое видно только когда он открыт (как у Radix).
const dialog = vi.hoisted(() => ({ open: false }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div>{children}</div> : null,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const MACHINE: MachineListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  gymId: '22222222-2222-4222-8222-222222222222',
  name: 'Гакк-машина',
  zone: 'Ноги',
  weightStepKg: 5,
  photoMediaId: null,
  archivedAt: null,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: new Date('2026-11-01T10:00:00Z'),
  photoUrl: null,
  thumbUrl: null,
  photoStatus: null,
}

afterEach(cleanup)

test('у нового тренажёра нет блока удаления', () => {
  render(<MachineForm zones={['Ноги']} />)

  expect(screen.queryByText('Удалить тренажёр')).toBeNull()
})

test('тренажёр без упражнений: «Удалить» активна и спрашивает подтверждение', async () => {
  render(<MachineForm machine={MACHINE} zones={['Ноги']} exerciseCount={0} />)

  expect(screen.getByText('Удалить тренажёр')).toBeTruthy()
  expect(screen.getByText(/занёс по ошибке/)).toBeTruthy()

  const button = screen.getByRole('button', { name: 'Удалить' })
  expect(button.hasAttribute('disabled')).toBe(false)
  // До подтверждения диалога нет.
  expect(screen.queryByText('Удалить «Гакк-машина»?')).toBeNull()

  fireEvent.click(button)
  await waitFor(() => expect(screen.getByText('Удалить «Гакк-машина»?')).toBeTruthy())
  expect(screen.getByText(/необратимо/)).toBeTruthy()
  // В диалоге две кнопки: «Отмена» и подтверждение.
  expect(screen.getByRole('button', { name: 'Отмена' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Удалить' })).toHaveLength(2)
})

test('тренажёр с упражнениями удалить нельзя: кнопка неактивна и объясняет почему', () => {
  render(<MachineForm machine={MACHINE} zones={['Ноги']} exerciseCount={3} />)

  const button = screen.getByRole('button', { name: 'Удалить' })
  expect(button.hasAttribute('disabled')).toBe(true)

  // Предупреждение — с правильным склонением и подсказкой, что делать.
  expect(screen.getByText('К тренажёру привязано 3 упражнения — удалить нельзя.')).toBeTruthy()
  expect(screen.getByText(/выбери им другой тренажёр/)).toBeTruthy()
  // Диалог подтверждения в этом случае не открывается.
  expect(screen.queryByText('Удалить «Гакк-машина»?')).toBeNull()
})

test('одно упражнение — «1 упражнение», а не «1 упражнений»', () => {
  render(<MachineForm machine={MACHINE} zones={['Ноги']} exerciseCount={1} />)

  expect(screen.getByText('К тренажёру привязано 1 упражнение — удалить нельзя.')).toBeTruthy()
})

test('сервер отказал в удалении: причина видна прямо в модальном окне', async () => {
  server.deleteError = 'К тренажёру привязаны упражнения: 2. Сначала перенеси их на другой тренажёр'

  render(<MachineForm machine={MACHINE} zones={['Ноги']} exerciseCount={0} />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  await waitFor(() => expect(screen.getByText('Удалить «Гакк-машина»?')).toBeTruthy())

  fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]!)

  // Окно не закрылось, заголовок сменился, причина и что делать — внутри окна.
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('К тренажёру привязаны упражнения: 2')
  expect(alert.textContent).toContain('выбери им другой тренажёр')
  expect(screen.getByText('Удалить не получилось')).toBeTruthy()
  expect(screen.getByText('Тренажёр остался в каталоге — ниже причина.')).toBeTruthy()
  // Вместо «Отмена/Удалить» — одна кнопка «Понятно».
  expect(screen.getByRole('button', { name: 'Понятно' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Отмена' })).toBeNull()

  server.deleteError = null
})

