// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TemplateMetaEditor } from './template-meta-editor'

const server = vi.hoisted(() => ({
  calls: [] as { templateId: string; name: string; audience: string | null; goal: string | null }[],
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

vi.mock('@/app/(app)/app/trainer/programs/actions', () => ({
  updateTemplateMetaAction: async (input: {
    templateId: string
    name: string
    audience: string | null
    goal: string | null
  }) => {
    server.calls.push(input)
    return { error: server.error }
  },
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

function renderEditor(overrides: Partial<Parameters<typeof TemplateMetaEditor>[0]> = {}): void {
  render(
    <TemplateMetaEditor
      templateId="tpl-1"
      name="Похудение"
      audience="female"
      goal="fat_loss"
      number={3}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  server.calls = []
  server.error = null
  toasts.success = []
  toasts.error = []
  dialog.open = false
})

afterEach(() => {
  cleanup()
})

test('кнопка «Изменить» открывает окно с текущими значениями', () => {
  renderEditor()

  expect(screen.queryByRole('dialog')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))

  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Похудение')
  // Аудитория и цель подсвечены как выбранные.
  expect(
    screen.getByRole('button', { name: 'для женщин' }).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(screen.getByRole('button', { name: 'Похудение' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  // Номер шаблона не меняется — об этом сказано в подсказке.
  expect(screen.getByText(/номер №3 не меняется/)).toBeTruthy()
})

test('сохранение отправляет новое название, аудиторию и цель', async () => {
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: '  Жиросжигание  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'для всех' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сила' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(server.calls).toHaveLength(1))
  expect(server.calls[0]).toEqual({
    templateId: 'tpl-1',
    name: 'Жиросжигание',
    audience: 'any',
    goal: 'strength',
  })
  await vi.waitFor(() => expect(toasts.success).toContain('Шаблон сохранён'))
})

test('пустое название не отправляется: понятная ошибка', () => {
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' Я ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(screen.getByRole('alert').textContent).toBe('Название — от 2 символов')
  expect(server.calls).toHaveLength(0)
})

test('отказ сервера показывается в окне и тостом, окно не закрывается', async () => {
  server.error = 'Шаблон не сохранён'
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Другое' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(toasts.error).toContain('Шаблон не сохранён'))
  expect(screen.getByRole('alert').textContent).toBe('Шаблон не сохранён')
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('«Отмена» ничего не отправляет и не меняет название', () => {
  renderEditor()

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Черновик' } })
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  expect(server.calls).toHaveLength(0)

  // Открыли снова — поле снова с настоящим названием, а не с забытой правкой.
  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Похудение')
})

test('у шаблона без номера подсказка без «№»', () => {
  renderEditor({ number: null })

  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))

  expect(screen.getByText('Название, для кого программа и цель')).toBeTruthy()
})
