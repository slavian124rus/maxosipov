// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { TemplateCreatedNotice } from './template-created-notice'

const spy = vi.hoisted(() => ({
  toasts: [] as string[],
  replaced: [] as string[],
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/trainer/programs/p-1',
  useRouter: () => ({ replace: (href: string) => spy.replaced.push(href) }),
}))

vi.mock('sonner', () => ({
  toast: { success: (title: string) => spy.toasts.push(title) },
}))

afterEach(() => {
  cleanup()
  spy.toasts = []
  spy.replaced = []
})

test('после создания шаблона тост показывается один раз и адрес чистится', () => {
  render(<TemplateCreatedNotice />)

  expect(spy.toasts).toEqual(['Шаблон создан'])
  // `?created=1` убираем из адреса: возврат назад и перезагрузка молчат.
  expect(spy.replaced).toEqual(['/trainer/programs/p-1'])
})

test('повторный рендер не показывает тост снова', () => {
  const first = render(<TemplateCreatedNotice />)
  first.unmount()

  expect(spy.toasts).toHaveLength(1)
})
