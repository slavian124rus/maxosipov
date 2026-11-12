// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { WeightPreview } from '@/app/(app)/app/trainer/clients/program-actions'
import { ProgramActions } from './program-actions'

const server = vi.hoisted(() => ({
  assigned: [] as { clientId: string; templateId: string }[],
  removed: [] as { clientId: string; programId: string }[],
  applied: [] as Record<string, number>[],
  preview: null as WeightPreview | null,
  error: null as string | null,
}))

const toasts = vi.hoisted(() => ({ success: [] as string[], error: [] as string[] }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (title: string) => toasts.success.push(title),
    error: (title: string) => toasts.error.push(title),
  },
}))

vi.mock('@/app/(app)/app/trainer/clients/program-actions', () => ({
  assignClientProgramAction: async (input: { clientId: string; templateId: string }) => {
    server.assigned.push(input)
    return { error: server.error, message: 'Программа выдана. Веса по анкете: 3 из 5' }
  },
  removeClientProgramAction: async (input: { clientId: string; programId: string }) => {
    server.removed.push(input)
    return { error: server.error, message: 'Программа удалена' }
  },
  previewClientWeightsAction: async () => server.preview,
  applyClientWeightsAction: async (input: { weights: Record<string, number> }) => {
    server.applied.push(input.weights)
    return { error: server.error, message: 'Веса обновлены: 2' }
  },
}))

// Диалоги Radix портируют содержимое в body: здесь каждый Dialog знает свой `open`.
vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')
  const OpenContext = React.createContext(false)

  const wrapper =
    (tag: 'div' | 'h2' | 'p') =>
    function DialogPart({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, null, children)
    }

  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      React.createElement(OpenContext.Provider, { value: Boolean(open) }, children),
    DialogContent: ({ children }: { children?: React.ReactNode }) => {
      const open = React.useContext(OpenContext)
      return open ? React.createElement('div', { role: 'dialog' }, children) : null
    },
    DialogHeader: wrapper('div'),
    DialogFooter: wrapper('div'),
    DialogTitle: wrapper('h2'),
    DialogDescription: wrapper('p'),
  }
})

const TEMPLATES = [
  { id: 'tpl-1', title: 'Похудение для женщин №1', subtitle: 'Похудение · 3 дня · 15 упражнений' },
  { id: 'tpl-2', title: 'Масса для мужчин №2', subtitle: 'Масса · 4 дня · 20 упражнений' },
]

const PREVIEW: WeightPreview = {
  error: null,
  source: 'ai',
  summary: 'Начинаем аккуратно: новичок, цель — похудение',
  items: [
    { exerciseId: 'ex-gakk', name: 'Гакк-приседания', weightKg: 20, reason: 'новичок' },
    { exerciseId: 'ex-row', name: 'Тяга блока', weightKg: 15, reason: 'верх тела' },
  ],
}

beforeEach(() => {
  server.assigned = []
  server.removed = []
  server.applied = []
  server.preview = PREVIEW
  server.error = null
  toasts.success = []
  toasts.error = []
})

afterEach(() => {
  cleanup()
})

test('без программы: «Активной программы нет» и выдача шаблона', async () => {
  render(<ProgramActions clientId="c-1" templates={TEMPLATES} program={null} />)

  expect(screen.getByText('Активной программы нет')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Выдать программу' }))
  expect(screen.getByText('Похудение для женщин №1')).toBeTruthy()
  expect(screen.getByText('Масса для мужчин №2')).toBeTruthy()

  fireEvent.click(screen.getByText('Похудение для женщин №1'))
  const confirm = screen.getAllByRole('button', { name: 'Выдать программу' })
  fireEvent.click(confirm[confirm.length - 1]!)

  await vi.waitFor(() => expect(server.assigned).toEqual([{ clientId: 'c-1', templateId: 'tpl-1' }]))
  await vi.waitFor(() => expect(toasts.success).toContain('Программа выдана. Веса по анкете: 3 из 5'))
})


test('с программой: смена, веса и удаление с подтверждением', async () => {
  render(<ProgramActions clientId="c-1" templates={TEMPLATES} program={{ id: 'p-1', name: 'Похудение' }} />)

  expect(screen.getByRole('button', { name: 'Сменить программу' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Подобрать веса/ })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Удалить программу/ }))
  expect(screen.getByText('Удалить программу «Похудение»?')).toBeTruthy()

  const buttons = screen.getAllByRole('button', { name: 'Удалить программу' })
  fireEvent.click(buttons[buttons.length - 1]!)

  await vi.waitFor(() =>
    expect(server.removed).toEqual([{ clientId: 'c-1', programId: 'p-1' }]),
  )
  await vi.waitFor(() => expect(toasts.success).toContain('Программа удалена'))
})

test('«Подобрать веса»: предпросмотр с обоснованием и применение', async () => {
  render(<ProgramActions clientId="c-1" templates={TEMPLATES} program={{ id: 'p-1', name: 'Похудение' }} />)

  fireEvent.click(screen.getByRole('button', { name: /Подобрать веса/ }))

  await vi.waitFor(() => expect(screen.getByText('Начинаем аккуратно: новичок, цель — похудение')).toBeTruthy())
  expect(screen.getByText('Гакк-приседания')).toBeTruthy()
  expect(screen.getByText('новичок')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Применить' }))

  await vi.waitFor(() => expect(server.applied).toEqual([{ 'ex-gakk': 20, 'ex-row': 15 }]))
  await vi.waitFor(() => expect(toasts.success).toContain('Веса обновлены: 2'))
})

test('ошибка сервера показывается тостом, окно не врёт про успех', async () => {
  server.error = 'Нет прав на программу'
  render(<ProgramActions clientId="c-1" templates={TEMPLATES} program={null} />)

  fireEvent.click(screen.getByRole('button', { name: 'Выдать программу' }))
  fireEvent.click(screen.getByText('Масса для мужчин №2'))
  const confirm = screen.getAllByRole('button', { name: 'Выдать программу' })
  fireEvent.click(confirm[confirm.length - 1]!)

  await vi.waitFor(() => expect(toasts.error).toContain('Нет прав на программу'))
  expect(toasts.success).toHaveLength(0)
})

test('без шаблонов кнопка выдачи неактивна и есть подсказка', () => {
  render(<ProgramActions clientId="c-1" templates={[]} program={null} />)

  const button = screen.getByRole('button', { name: 'Выдать программу' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(screen.getByText(/Шаблонов пока нет/)).toBeTruthy()
})
