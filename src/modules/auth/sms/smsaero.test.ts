import { afterEach, expect, test, vi } from 'vitest'
import { createSmsAeroProvider } from './smsaero'

const OPTIONS = { login: 'owner@example.com', apiKey: 'secret-key', sign: 'SMS Aero' }

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

test('шлёт GET на gate.smsaero.ru с Basic-авторизацией, номером без плюса и подписью', async () => {
  const fetchMock = mockFetch({ success: true, data: { status: 0, extendStatus: 'queue' }, message: null })
  await createSmsAeroProvider(OPTIONS).send('+79233705421', 'Код: 1234')

  const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
  expect(url.origin + url.pathname).toBe('https://gate.smsaero.ru/v2/sms/send')
  expect(url.searchParams.get('number')).toBe('79233705421')
  expect(url.searchParams.get('text')).toBe('Код: 1234')
  expect(url.searchParams.get('sign')).toBe('SMS Aero')
  expect((init.headers as Record<string, string>).Authorization).toBe(
    `Basic ${Buffer.from('owner@example.com:secret-key').toString('base64')}`,
  )
  // Ключ не должен попадать в адрес запроса.
  expect(url.toString()).not.toContain('secret-key')
})

test('success=false — ошибка с сообщением сервиса', async () => {
  mockFetch({ success: false, data: null, message: 'Недостаточно средств' })
  await expect(createSmsAeroProvider(OPTIONS).send('+79233705421', 'x')).rejects.toThrow(/Недостаточно средств/)
})

test('статус «не доставлено» и «отклонено» — ошибка', async () => {
  for (const status of [2, 6]) {
    mockFetch({ success: true, data: { status, extendStatus: 'reject' }, message: null })
    await expect(createSmsAeroProvider(OPTIONS).send('+79233705421', 'x')).rejects.toThrow(/SMS Aero/)
  }
})

test('ответ не JSON — ошибка без утечки ключа', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 502 })))
  const error = await createSmsAeroProvider(OPTIONS).send('+79233705421', 'x').catch((e: Error) => e)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).not.toContain('secret-key')
})
