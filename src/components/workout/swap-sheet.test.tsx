// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SwapSheet } from './swap-sheet'

// Диалоги Radix в jsdom портируют содержимое в body — подменяем простыми контейнерами.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

afterEach(cleanup)

const OPTIONS = [
  { id: 'a', name: 'Жим ногами', machineName: 'Платформа' },
  { id: 'b', name: 'Выпады', machineName: null },
]

test('можно выбрать упражнение и подтвердить замену', () => {
  render(<SwapSheet exerciseName="Гакк" options={OPTIONS} onClose={() => {}} onPick={async () => null} />)

  fireEvent.click(screen.getByRole('button', { name: /Жим ногами/ }))
  expect(screen.getByRole('button', { name: 'Только сегодня' })).toBeTruthy()
})

test('когда заменить нельзя, список виден, но выбрать нельзя, и сказано почему', () => {
  render(
    <SwapSheet
      exerciseName="Гакк"
      options={OPTIONS}
      lockedReason="Подход уже записан: заменить можно только до первого подхода"
      onClose={() => {}}
      onPick={async () => null}
    />,
  )

  expect(screen.getByText(/заменить можно только до первого подхода/)).toBeTruthy()
  expect(screen.getByText('Жим ногами')).toBeTruthy()
  expect(screen.getByText('Платформа')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Жим ногами/ })).toBeNull()
})
