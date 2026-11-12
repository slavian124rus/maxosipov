// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ProgramTree } from '@/modules/training'
import { ProgramEditor, type CatalogItem } from './program-editor'

const server = vi.hoisted(() => ({
  patches: [] as unknown[],
  error: null as string | null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}))

vi.mock('@/app/(app)/app/trainer/programs/actions', () => ({
  patchProgramAction: async (input: { patch: unknown }) => {
    server.patches.push(input.patch)
    return { error: server.error }
  },
  saveAsTemplateAction: async () => ({ error: null, id: 'new-template' }),
}))

vi.mock('sonner', () => ({
  toast: { success: () => {}, error: () => {} },
}))

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
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const CATALOG: CatalogItem[] = [
  {
    id: 'ex-gakk',
    name: 'Гакк-приседания',
    machineName: 'Гакк-машина',
    zone: 'Ноги',
    primary: ['quads'],
  },
  {
    id: 'ex-row',
    name: 'Тяга блока',
    machineName: 'Верхний блок',
    zone: 'Спина',
    primary: ['lats'],
  },
]

const PROGRAM: ProgramTree = {
  id: 'p-1',
  ownerId: null,
  authorKind: 'trainer',
  name: 'Похудение',
  status: 'active',
  days: [
    {
      id: 'day-1',
      order: 1,
      name: 'День 1 — ноги',
      exercises: [
        {
          id: 'pe-1',
          order: 1,
          exerciseId: 'ex-gakk',
          sets: 3,
          repMin: 10,
          repMax: 12,
          restSec: 90,
          targetWeightKg: 40,
          note: null,
        },
      ],
    },
    { id: 'day-2', order: 2, name: 'День 2 — спина', exercises: [] },
  ],
}

beforeEach(() => {
  server.patches = []
  server.error = null
})

afterEach(() => {
  cleanup()
})

test('упражнение в дне — ссылка на свою страницу, а не шторка', () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  const link = screen.getByRole('link', { name: /Гакк-приседания/ })
  expect(link.getAttribute('href')).toBe('/trainer/programs/p-1/exercises/pe-1')
})

test('схема упражнения видна прямо в строке', () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  expect(screen.getByText('3 подхода · 10–12 раз')).toBeTruthy()
  expect(screen.getByText(/Гакк-машина · 40 кг/)).toBeTruthy()
})

test('имя дня правится на месте: «Переименовать день» → ввод → сохранить', async () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  expect(screen.getByRole('heading', { name: 'День 1 — ноги' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Переименовать день' }))

  const input = screen.getByLabelText('Название дня') as HTMLInputElement
  expect(input.value).toBe('День 1 — ноги')

  fireEvent.change(input, { target: { value: 'День 1 — ноги и пресс' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({
    ops: [{ op: 'rename_day', dayId: 'day-1', name: 'День 1 — ноги и пресс' }],
  })
})

test('«Отмена» в переименовании не отправляет патч', () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'Переименовать день' }))
  fireEvent.change(screen.getByLabelText('Название дня'), { target: { value: 'Другое' } })
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  expect(screen.getByRole('heading', { name: 'День 1 — ноги' })).toBeTruthy()
  expect(server.patches).toHaveLength(0)
})

test('пустой день подсказывает, что делать, и «+ День» добавляет следующий', async () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'День 2 — спина' }))
  expect(screen.getByText('В этом дне пока нет упражнений — добавь ниже')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: '+ День' }))

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({ ops: [{ op: 'add_day', name: 'День 3' }] })
})

test('«Удалить день» спрашивает подтверждение и отправляет delete_day', async () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить день' }))

  const dialogBox = screen.getByRole('dialog')
  expect(dialogBox.textContent).toContain('Удалить день «День 1 — ноги»?')
  // В дне одно упражнение — предупреждаем, что оно уйдёт вместе с днём.
  expect(dialogBox.textContent).toContain('1 упражнение')
  expect(dialogBox.textContent).toContain('останутся в истории')

  // Кнопка в диалоге, а не в шапке дня.
  fireEvent.click(within(dialogBox).getByRole('button', { name: 'Удалить день' }))

  await vi.waitFor(() => expect(server.patches).toHaveLength(1))
  expect(server.patches[0]).toEqual({ ops: [{ op: 'delete_day', dayId: 'day-1' }] })
})

test('после удаления дня редактор переключается на соседний день', async () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить день' }))
  const buttons = screen.getAllByRole('button', { name: 'Удалить день' })
  fireEvent.click(buttons[buttons.length - 1]!)

  // Первый день исчез — показан второй, а не пустой экран.
  await vi.waitFor(() =>
    expect(screen.getByRole('heading', { name: 'День 2 — спина' })).toBeTruthy(),
  )
  expect(screen.getByText('В этом дне пока нет упражнений — добавь ниже')).toBeTruthy()
})

test('«Отмена» в удалении дня ничего не удаляет', () => {
  render(<ProgramEditor program={PROGRAM} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить день' }))
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  expect(screen.getByRole('heading', { name: 'День 1 — ноги' })).toBeTruthy()
  expect(server.patches).toHaveLength(0)
})

test('в предупреждении про последний день сказано, что дней не останется', () => {
  const single: ProgramTree = { ...PROGRAM, days: [PROGRAM.days[0]!] }
  render(<ProgramEditor program={single} catalog={CATALOG} />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить день' }))

  expect(screen.getByRole('dialog').textContent).toContain('Это последний день')
})

