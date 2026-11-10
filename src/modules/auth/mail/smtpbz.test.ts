import { afterEach, expect, test, vi } from 'vitest'
import { createSmtpBzProvider } from './smtpbz'

const OPTIONS = { apiKey: 'secret-key', from: 'noreply@maxosipov.ru', fromName: 'МаксИИм' }
const MESSAGE = { subject: 'Код входа', text: 'Код: 123456', html: '<p>Код: 123456</p>' }

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

test('шлёт POST на api.smtp.bz с ключом в заголовке и полями письма в JSON', async () => {
  const fetchMock = mockFetch({ result: true, messageid: 'abc' })
  await createSmtpBzProvider(OPTIONS).send('user@example.com', MESSAGE)

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.smtp.bz/v1/smtp/send')
  expect(init.method).toBe('POST')
  const headers = init.headers as Record<string, string>
  expect(headers.Authorization).toBe('secret-key')
  expect(headers['Content-Type']).toBe('application/json')
  expect(JSON.parse(String(init.body))).toEqual({
    from: 'noreply@maxosipov.ru',
    name: 'МаксИИм',
    to: 'user@example.com',
    subject: 'Код входа',
    text: 'Код: 123456',
    html: '<p>Код: 123456</p>',
  })
  // Ключ не должен попадать в адрес и в тело.
  expect(url).not.toContain('secret-key')
  expect(String(init.body)).not.toContain('secret-key')
})

test('result=false — ошибка с сообщением сервиса', async () => {
  mockFetch({ result: false, errors: { message: 'Domain maxosipov.ru not verified' } }, 400)
  await expect(createSmtpBzProvider(OPTIONS).send('user@example.com', MESSAGE)).rejects.toThrow(
    /not verified/,
  )
})

test('ответ не JSON — ошибка без утечки ключа', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 502 })))
  const error = await createSmtpBzProvider(OPTIONS)
    .send('user@example.com', MESSAGE)
    .catch((e: Error) => e)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toMatch(/SMTP\.bz/)
  expect((error as Error).message).not.toContain('secret-key')
})

test('таймаут сети — ошибка, а не зависание', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') }))
  await expect(createSmtpBzProvider(OPTIONS).send('user@example.com', MESSAGE)).rejects.toThrow(/SMTP\.bz/)
})
