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

test('ошибка провайдера содержит код и модель', async () => {
  vi.stubGlobal('fetch', async () => new Response('boom', { status: 404 }))

  await expect(
    new PlusvibeSpeechToText().transcribe({ path: audio, mime: 'audio/webm' }),
  ).rejects.toThrow('Распознавание не удалось: 404 (whisper-large-v3)')
})
