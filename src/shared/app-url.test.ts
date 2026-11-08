import { expect, test } from 'vitest'
import { appUrl } from './app-url'

test('строит адрес от APP_URL, а не от адреса запроса', () => {
  expect(appUrl('/login', 'https://app.maxosipov.ru').toString()).toBe(
    'https://app.maxosipov.ru/login',
  )
  expect(appUrl('/login?error=oauth', 'https://app.maxosipov.ru/').toString()).toBe(
    'https://app.maxosipov.ru/login?error=oauth',
  )
  expect(appUrl('/', 'http://app.localhost:3000').toString()).toBe('http://app.localhost:3000/')
})
