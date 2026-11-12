// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PhotoViewer } from './photo-viewer'

const dialog = vi.hoisted(() => ({ open: false }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div role="dialog">{children}</div> : null,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

beforeEach(() => {
  dialog.open = false
})

afterEach(() => {
  cleanup()
})

test('закрытое окно ничего не рисует', () => {
  render(<PhotoViewer src="/media/photo.jpg" alt="Фото: Гакк" open={false} onOpenChange={() => {}} />)

  expect(screen.queryByRole('dialog')).toBeNull()
})

test('открытое показывает фото целиком: contain, а не обрезка', () => {
  render(<PhotoViewer src="/media/photo.jpg" alt="Фото: Гакк" open onOpenChange={() => {}} />)

  const box = screen.getByRole('dialog')
  const image = box.querySelector('img')

  expect(image?.getAttribute('src')).toBe('/media/photo.jpg')
  // `object-contain` — фото вписывается целиком, ничего не обрезано по центру.
  expect(image?.className).toContain('object-contain')
  expect(image?.className).not.toContain('object-cover')
})

test('касание по фото и крестик закрывают окно', () => {
  const onOpenChange = vi.fn()
  render(<PhotoViewer src="/media/photo.jpg" alt="Фото: Гакк" open onOpenChange={onOpenChange} />)

  // Две кнопки с одинаковой подписью: крестик в шапке и само фото.
  const closers = screen.getAllByRole('button', { name: 'Закрыть фото' })
  expect(closers).toHaveLength(2)

  fireEvent.click(closers[0]!)
  expect(onOpenChange).toHaveBeenCalledWith(false)

  onOpenChange.mockClear()
  fireEvent.click(closers[1]!)
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

test('без фото окно показывает только заголовок', () => {
  render(<PhotoViewer src={null} alt="Фото: Гакк" open onOpenChange={() => {}} />)

  expect(screen.getByRole('dialog').querySelector('img')).toBeNull()
  expect(screen.getByText('Фото: Гакк')).toBeTruthy()
})
