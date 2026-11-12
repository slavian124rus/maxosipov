import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'

/** Окружение подменяем: в тестах нет ни ключа, ни адреса провайдера. */
const envMock = vi.hoisted(() => ({
  value: {
    AI_BASE_URL: 'https://plusvibeapi.ru/v1',
    AI_API_KEY: 'test-key' as string | undefined,
    STT_PROVIDER: undefined as 'plusvibe' | 'yandex' | undefined,
    STT_MODEL: undefined as string | undefined,
    STT_BASE_URL: undefined as string | undefined,
  },
}))

vi.mock('@/shared/env', () => ({ env: envMock.value }))

const { getSpeechToText, speechModelName, PlusvibeSpeechToText, YandexSpeechToText, DEFAULT_STT_MODEL } =
  await import('./index')

let dir = ''
let audio = ''

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'stt-test-'))
  audio = path.join(dir, 'voice')
  await writeFile(audio, Buffer.from('audio-bytes'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

beforeEach(() => {
  envMock.value.AI_API_KEY = 'test-key'
  envMock.value.STT_PROVIDER = undefined
  envMock.value.STT_MODEL = undefined
  envMock.value.STT_BASE_URL = undefined
  vi.unstubAllGlobals()
})

test('по умолчанию провайдер plusvibe — отдельная настройка не нужна', () => {
  expect(getSpeechToText()).toBeInstanceOf(PlusvibeSpeechToText)
})

test('Yandex включается явно', () => {
  envMock.value.STT_PROVIDER = 'yandex'
  expect(getSpeechToText()).toBeInstanceOf(YandexSpeechToText)
})

test('по умолчанию модель whisper-large-v3', () => {
  expect(DEFAULT_STT_MODEL).toBe('whisper-large-v3')
  expect(speechModelName()).toBe('whisper-large-v3')
})

test('STT_MODEL переопределяет модель', () => {
  envMock.value.STT_MODEL = 'whisper-1'
  expect(speechModelName()).toBe('whisper-1')
})

test('запрос идёт на {AI_BASE_URL}/audio/transcriptions с моделью и языком ru', async () => {
  let captured: { url: string; auth: string | null; model: FormDataEntryValue | null; lang: FormDataEntryValue | null } | null =
    null

  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const form = init.body as FormData
    captured = {
      url,
      auth: new Headers(init.headers).get('authorization'),
      model: form.get('model'),
      lang: form.get('language'),
    }

    return new Response(JSON.stringify({ text: '  жим ногами 40 на 10  ' }), { status: 200 })
  })

  const text = await new PlusvibeSpeechToText().transcribe({ path: audio, mime: 'audio/webm' })

  expect(text).toBe('жим ногами 40 на 10')
  expect(captured).toEqual({
    url: 'https://plusvibeapi.ru/v1/audio/transcriptions',
    auth: 'Bearer test-key',
    model: 'whisper-large-v3',
    lang: 'ru',
  })
})

test('без AI_API_KEY — понятная ошибка про ключ, а не про STT_PROVIDER', async () => {
  envMock.value.AI_API_KEY = undefined

  await expect(
    new PlusvibeSpeechToText().transcribe({ path: audio, mime: 'audio/webm' }),
  ).rejects.toThrow('Распознавание речи не настроено: нет AI_API_KEY')
})

test('ошибка провайдера объясняет причину: код, подсказка и ответ', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response('{"error":"model not allowed for this key"}', {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
  )

  const error = await new PlusvibeSpeechToText()
    .transcribe({ path: audio, mime: 'audio/webm' })
    .catch((caught: Error) => caught)

  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message

  expect(message).toContain('Распознавание не удалось: 403')
  // Подсказка про доступ к модели — чтобы не гадать, почему «модель правильная», а отказ есть.
  expect(message).toContain('нет доступа к модели «whisper-large-v3»')
  // И сам ответ провайдера: по нему видно настоящую причину.
  expect(message).toContain('model not allowed for this key')
})

test('404 — отдельная подсказка про эндпоинт и модель', async () => {
  vi.stubGlobal('fetch', async () => new Response('Not Found', { status: 404 }))

  await expect(
    new PlusvibeSpeechToText().transcribe({ path: audio, mime: 'audio/webm' }),
  ).rejects.toThrow(/404 — такого эндпоинта или модели у провайдера нет/)
})

test('STT_BASE_URL переопределяет адрес распознавания', async () => {
  envMock.value.STT_BASE_URL = 'https://stt.example.com/v1'
  let url = ''

  vi.stubGlobal('fetch', async (input: string) => {
    url = input
    return new Response(JSON.stringify({ text: 'ок' }), { status: 200 })
  })

  await new PlusvibeSpeechToText().transcribe({ path: audio, mime: 'audio/webm' })
  expect(url).toBe('https://stt.example.com/v1/audio/transcriptions')

  envMock.value.STT_BASE_URL = undefined
})
