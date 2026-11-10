import { afterEach, expect, test, vi } from 'vitest'
import { formatLeadMessage, sendTelegramMessage } from './telegram'

const OPTIONS = { token: '123:secret-token', chatId: '-1001234567890' }

afterEach(() => vi.unstubAllGlobals())

test('шлёт sendMessage в нужный чат, токен только в адресе Bot API', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await sendTelegramMessage({ ...OPTIONS, text: 'Привет' })

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.telegram.org/bot123:secret-token/sendMessage')
  expect(JSON.parse(String(init.body))).toEqual({
    chat_id: '-1001234567890',
    text: 'Привет',
    disable_web_page_preview: true,
  })
})

test('ok=false — ошибка с описанием Telegram и без токена', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: false, description: 'chat not found' }), { status: 400 })),
  )

  const error = await sendTelegramMessage({ ...OPTIONS, text: 'x' }).catch((e: Error) => e)
  expect((error as Error).message).toContain('chat not found')
  expect((error as Error).message).not.toContain('secret-token')
})

test('сетевой сбой не раскрывает токен', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('connect failed https://api.telegram.org/bot123:secret-token/sendMessage')
    }),
  )

  const error = await sendTelegramMessage({ ...OPTIONS, text: 'x' }).catch((e: Error) => e)
  expect((error as Error).message).not.toContain('secret-token')
})

test('текст заявки: имя, телефон, без разметки', () => {
  const text = formatLeadMessage({ name: '<b>Иван</b>', phone: '+79233705421' })
  expect(text).toContain('Новая заявка с сайта')
  expect(text).toContain('Имя: <b>Иван</b>')
  expect(text).toContain('Телефон: +79233705421')
})
