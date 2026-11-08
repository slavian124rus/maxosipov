import { expect, test } from 'vitest'
import { clientIpFrom } from './client-ip'

const h = (values: Record<string, string>) => new Headers(values)

test('берёт последний адрес из X-Forwarded-For (его добавил наш Caddy)', () => {
  expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6, 10.0.0.5' }))).toBe('10.0.0.5')
  expect(clientIpFrom(h({ 'x-forwarded-for': '10.0.0.5' }))).toBe('10.0.0.5')
})

test('без заголовка — x-real-ip или unknown', () => {
  expect(clientIpFrom(h({ 'x-real-ip': '10.0.0.7' }))).toBe('10.0.0.7')
  expect(clientIpFrom(h({}))).toBe('unknown')
})
