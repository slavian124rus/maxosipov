// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { HowToButton, HowToDialog, type HowToExercise } from './how-to'

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

const EXERCISE: HowToExercise = {
  name: 'Жим ногами',
  slug: 'zhim-nogami',
  machineName: 'Платформа',
  videoMp4Url: '/media/video.mp4',
  videoWebmUrl: null,
  posterUrl: '/media/poster.jpg',
  steps: ['Сядь и прижми спину', 'Поставь стопы на платформу'],
  mistakes: ['Отрыв пяток'],
  tips: 'Колени по носкам',
}

afterEach(() => {
  cleanup()
  dialog.open = false
})

test('закрытое окно ничего не рисует', () => {
  render(<HowToDialog exercise={EXERCISE} open={false} onOpenChange={() => {}} />)

  expect(screen.queryByRole('dialog')).toBeNull()
})

test('в окне: название, тренажёр, видео, шаги, ошибки и совет', () => {
  render(<HowToDialog exercise={EXERCISE} open onOpenChange={() => {}} />)

  const box = screen.getByRole('dialog')
  expect(box.textContent).toContain('Жим ногами')
  expect(box.textContent).toContain('Платформа')
  expect(box.textContent).toContain('Как делать')
  expect(box.textContent).toContain('Сядь и прижми спину')
  expect(box.textContent).toContain('Отрыв пяток')
  expect(box.textContent).toContain('Колени по носкам')

  // Видео с управлением: клиент сам решает, когда смотреть.
  const video = box.querySelector('video')
  expect(video?.getAttribute('src')).toBe('/media/video.mp4')
  expect(video?.hasAttribute('controls')).toBe(true)
})

test('без видео показываем фото тренажёра', () => {
  render(
    <HowToDialog
      exercise={{ ...EXERCISE, videoMp4Url: null }}
      open
      onOpenChange={() => {}}
    />,
  )

  expect(screen.getByRole('dialog').querySelector('video')).toBeNull()
  expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe(
    '/media/poster.jpg',
  )
})

test('без видео и фото — честная подпись вместо пустоты', () => {
  render(
    <HowToDialog
      exercise={{ ...EXERCISE, videoMp4Url: null, posterUrl: null }}
      open
      onOpenChange={() => {}}
    />,
  )

  expect(screen.getByText(/Видео и фото пока нет/)).toBeTruthy()
})

test('ссылка на полную карточку упражнения', () => {
  render(<HowToDialog exercise={EXERCISE} open onOpenChange={() => {}} />)

  const link = screen.getByRole('link', { name: 'Открыть карточку упражнения' })
  expect(link.getAttribute('href')).toBe('/exercises/zhim-nogami')
})

test('кнопка «Как делать» вызывает обработчик', () => {
  const onClick = vi.fn()
  render(<HowToButton onClick={onClick} label="Как делать: Жим ногами" />)

  fireEvent.click(screen.getByRole('button', { name: 'Как делать: Жим ногами' }))
  expect(onClick).toHaveBeenCalled()
})
