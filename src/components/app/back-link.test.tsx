// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { ClientBackLink } from './back-link'

afterEach(() => {
  cleanup()
})

test('ссылка ведёт на нужный экран и подписана словами', () => {
  render(<ClientBackLink href="/workouts" label="К тренировкам" />)

  const link = screen.getByRole('link', { name: 'К тренировкам' })
  expect(link.getAttribute('href')).toBe('/workouts')
})

test('видно, что это ссылка: стрелка и заметный цвет, а не серый текст', () => {
  render(<ClientBackLink href="/progress" label="К прогрессу" />)

  const link = screen.getByRole('link', { name: 'К прогрессу' })
  // Стрелка рядом с подписью — иконка внутри ссылки.
  expect(link.querySelector('svg')).not.toBeNull()
  // Размер по высоте — не меньше 44 px, чтобы палец попадал без прицела.
  expect(link.className).toContain('min-h-11')
  // Цвет текста не muted: ссылка не выглядит как отключённая подпись.
  expect(link.className).toContain('text-text-secondary')
  expect(link.className).not.toContain('text-text-muted')
})
