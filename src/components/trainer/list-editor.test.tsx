// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ListEditor } from './exercise-panels'

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

const STEPS = [
  'Сядь и прижми спину к спинке, стопы поставь на ширине плеч',
  'Возьмись за рукоятки и сведи лопатки',
]

beforeEach(() => {
  dialog.open = false
})

afterEach(() => {
  cleanup()
})

test('в списке виден текст пункта, окно закрыто до касания', () => {
  render(<ListEditor title="Как делать" items={STEPS} onChange={() => {}} placeholder="Шаг" />)

  expect(screen.getByText(STEPS[0]!)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('касание пункта открывает окно с полным текстом и многострочным полем', () => {
  render(<ListEditor title="Как делать" items={STEPS} onChange={() => {}} placeholder="Шаг" />)

  fireEvent.click(screen.getByText(STEPS[1]!))

  const box = screen.getByRole('dialog')
  expect(box.textContent).toContain('Как делать: пункт 2')

  const field = screen.getByLabelText('Текст пункта 2') as HTMLTextAreaElement
  // Именно textarea: длинный шаг видно целиком, а не в однострочном поле.
  expect(field.tagName).toBe('TEXTAREA')
  expect(field.value).toBe(STEPS[1])
  expect(field.rows).toBe(5)
})

test('правка и «Готово» отдают новый текст наверх', () => {
  const onChange = vi.fn()
  render(<ListEditor title="Как делать" items={STEPS} onChange={onChange} placeholder="Шаг" />)

  fireEvent.click(screen.getByText(STEPS[0]!))
  fireEvent.change(screen.getByLabelText('Текст пункта 1'), {
    target: { value: '  Сядь ровно и прижми спину  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

  expect(onChange).toHaveBeenCalledWith(['Сядь ровно и прижми спину', STEPS[1]])
  // Окно закрылось.
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('«Отмена» не меняет текст', () => {
  const onChange = vi.fn()
  render(<ListEditor title="Как делать" items={STEPS} onChange={onChange} placeholder="Шаг" />)

  fireEvent.click(screen.getByText(STEPS[0]!))
  fireEvent.change(screen.getByLabelText('Текст пункта 1'), { target: { value: 'Другое' } })
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  expect(onChange).not.toHaveBeenCalled()
})

test('«Добавить» сразу открывает окно для нового пункта', () => {
  const onChange = vi.fn()
  render(<ListEditor title="Частые ошибки" items={STEPS} onChange={onChange} placeholder="Ошибка" />)

  fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

  expect(onChange).toHaveBeenCalledWith([...STEPS, ''])
  expect(screen.getByRole('dialog').textContent).toContain('Частые ошибки: пункт 3')
  expect((screen.getByLabelText('Текст пункта 3') as HTMLTextAreaElement).value).toBe('')
})

test('удаление пункта не открывает окно', () => {
  const onChange = vi.fn()
  render(<ListEditor title="Как делать" items={STEPS} onChange={onChange} placeholder="Шаг" />)

  fireEvent.click(screen.getByRole('button', { name: 'Удалить пункт 1' }))

  expect(onChange).toHaveBeenCalledWith([STEPS[1]])
  expect(screen.queryByRole('dialog')).toBeNull()
})
