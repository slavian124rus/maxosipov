// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConversationList } from './conversation-list'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/app/(app)/app/(client)/coach/actions', () => ({
  archiveConversationAction: async () => ({ error: null }),
}))

afterEach(cleanup)

test('«Новый чат» есть в шапке рядом с заголовком, а не только внизу под панелью', () => {
  const { container } = render(<ConversationList items={[]} />)
  const header = container.querySelector('header')
  const link = screen.getByRole('link', { name: 'Новый чат' })
  expect(header?.contains(link)).toBe(true)
  expect(link.getAttribute('href')).toBe('/coach/new')
})
