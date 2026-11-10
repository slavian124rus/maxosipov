import { expect, test } from 'vitest'
import { adminUrl } from './app-url'

test('adminUrl: app.* → admin.*, путь сохраняется', () => {
  expect(adminUrl('/trainer/clients', 'https://app.maxosipov.ru').toString()).toBe(
    'https://admin.maxosipov.ru/trainer/clients',
  )
  expect(adminUrl('/', 'http://app.localhost:3000').toString()).toBe('http://admin.localhost:3000/')
})
