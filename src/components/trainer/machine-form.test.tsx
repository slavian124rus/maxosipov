// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { MachineListItem } from '@/modules/catalog'
import { MachineForm } from './machine-form'

// Серверные действия в jsdom не выполняются — подменяем их заглушками.
vi.mock('@/app/(app)/app/trainer/exercises/actions', () => ({
  saveMachineAction: async () => ({ error: null, ok: false, id: null }),
  deleteMachineAction: async () => ({ error: null, ok: false, id: null }),
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
  expect(screen.getByText(/привязаны упражнения: 3/)).toBeTruthy()
  expect(screen.getByText(/перенеси их на другой тренажёр/)).toBeTruthy()
})
