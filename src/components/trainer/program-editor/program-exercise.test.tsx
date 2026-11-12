// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ProgramTreeExercise } from '@/modules/training'
import type { CatalogItem } from './program-editor'
import { ProgramExerciseEditor } from './program-exercise'

const server = vi.hoisted(() => ({
  patches: [] as unknown[],
  error: null as string | null,
  pushed: [] as string[],
}))

const toasts = vi.hoisted(() => ({ success: [] as string[], error: [] as string[] }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: () => {},
    push: (href: string) => server.pushed.push(href),
  }),
}))

vi.mock('@/app/(app)/app/trainer/programs/actions', () => ({
  patchProgramAction: async (input: { patch: unknown }) => {
    server.patches.push(input.patch)
    return { error: server.error }
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: (title: string) => toasts.success.push(title),
    error: (title: string) => toasts.error.push(title),
  },
}))

// Диалоги Radix в jsdom портируют содержимое в body — подменяем простым условием по `open`.
const dialog = vi.hoisted(() => ({ open: false }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div role="dialog">{children}</div> : null,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const ITEM: ProgramTreeExercise = {
  id: 'pe-1',
  order: 1,
  exerciseId: 'ex-gakk',
  sets: 3,
  repMin: 10,
  repMax: 12,
  restSec: 90,
  targetWeightKg: 40,
  note: null,
}

const CATALOG: CatalogItem[] = [
  { id: 'ex-gakk', name: 'Гакк-приседания', machineName: 'Гакк-машина', zone: 'Ноги', primary: ['quads'] },
  { id: 'ex-leg', name: 'Разгибание ног', machineName: 'Блок', zone: 'Ноги', primary: ['quads'] },
]

function renderEditor(item: ProgramTreeExercise = ITEM): void {
  render(
    <ProgramExerciseEditor
      programId="p-1"
      clientId={null}
      backHref="/trainer/programs/p-1"
      backLabel="К шаблону"
      dayName="День 1 — ноги"
      item={item}
      exerciseName="Гакк-приседания"
      catalog={CATALOG}
    />,
  )
}

beforeEach(() => {
  server.patches = []
  server.error = null
  server.pushed = []
  toasts.success = []
  toasts.error = []
  dialog.open = false
})

afterEach(() => {
  cleanup()
})

test('поля названы по-человечески, схема видна целиком', () => {
  renderEditor()

  expect(screen.getByText('3 подхода · 10–12 раз · отдых 90 с')).toBeTruthy()
  expect(screen.getByText('Подходы')).toBeTruthy()
  expect(screen.getByText('Повторения от')).toBeTruthy()
  expect(screen.getByText('Повторения до')).toBeTruthy()
  expect(screen.getByText('Отдых, секунд')).toBeTruthy()
  expect(screen.getByLabelText('Целевой вес')).toBeTruthy()
  expect(screen.getByLabelText('Заметка')).toBeTruthy()
})

test('без изменений «Сохранить» неактивна', () => {
  renderEditor()

  const button = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(screen.getByText('Всё сохранено')).toBeTruthy()
})

test('«+» у подходов включает «Сохранить» и отправляет один патч', async () => {
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Подходы больше' }))

  expect(screen.getByText('4 подхода · 10–12 раз · отдых 90 с')).toBeTruthy()
  expect(screen.getByText('Есть несохранённые изменения')).toBeTruthy()

  const button = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement
  expect(button.disabled).toBe(false)
  fireEvent.click(button)

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({
    ops: [{ op: 'set_sets_reps', programExerciseId: 'pe-1', sets: 4, repMin: 10, repMax: 12, restSec: 90 }],
  })
  expect(toasts.success).toContain('Сохранено')
})


test('вес и заметка уходят тем же патчем, что и схема', async () => {
  renderEditor()

  fireEvent.change(screen.getByLabelText('Целевой вес'), { target: { value: '45,5' } })
  fireEvent.change(screen.getByLabelText('Заметка'), { target: { value: 'Следи за спиной' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({
    ops: [
      { op: 'set_target_weight', programExerciseId: 'pe-1', weightKg: 45.5 },
      { op: 'set_note', programExerciseId: 'pe-1', note: 'Следи за спиной' },
    ],
  })
})

test('«Убрать» спрашивает подтверждение и возвращает к шаблону', async () => {
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Убрать' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Убрать «Гакк-приседания» из дня?')).toBeTruthy()

  const confirm = screen.getAllByRole('button', { name: 'Убрать' })
  fireEvent.click(confirm[confirm.length - 1]!)

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({ ops: [{ op: 'remove_exercise', programExerciseId: 'pe-1' }] })
  await vi.waitFor(() => expect(server.pushed).toEqual(['/trainer/programs/p-1']))
})

test('ошибка сервера показывается и тостом, и текстом', async () => {
  server.error = 'Нет прав на программу'
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Подходы больше' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(toasts.error).toContain('Нет прав на программу'))
  expect(screen.getByRole('alert').textContent).toBe('Нет прав на программу')
})

