import { expect, test, vi } from 'vitest'
import type { LanguageModel } from 'ai'
import type { ModelKind } from './provider'
import {
  AiUnavailableError,
  applyModelSettings,
  DEFAULT_TEMPLATES_MODEL,
  defaultModelName,
  getModelName,
  listProviderModels,
  refreshModelOverrides,
  withFallback,
} from './provider'

const modelA = { modelId: 'main-model' } as unknown as LanguageModel
const modelB = { modelId: 'fallback-model' } as unknown as LanguageModel

function models(): { getModel: (kind: ModelKind) => LanguageModel } {
  return {
    getModel: (kind) => (kind === 'fallback' ? modelB : modelA),
  }
}

test('основная модель висит дольше таймаута — вызывается запасная', async () => {
  const fn = vi.fn(async (model: LanguageModel) => {
    if (model === modelA) return new Promise<string>(() => undefined)
    return 'ответ запасной'
  })

  const result = await withFallback(fn, 'main', { ...models(), timeoutMs: 50 })

  expect(result).toBe('ответ запасной')
  expect(fn).toHaveBeenCalledTimes(2)
  expect(fn.mock.calls[1]?.[0]).toBe(modelB)
})

test('основная модель упала — один повтор на запасной', async () => {
  const fn = vi.fn(async (model: LanguageModel) => {
    if (model === modelA) throw new Error('500')
    return 'ok'
  })

  await expect(withFallback(fn, 'fast', { ...models(), timeoutMs: 100 })).resolves.toBe('ok')
  expect(fn).toHaveBeenCalledTimes(2)
})

test('обе модели недоступны — AiUnavailableError', async () => {
  const fn = vi.fn(async () => {
    throw new Error('network')
  })

  await expect(withFallback(fn, 'main', { ...models(), timeoutMs: 50 })).rejects.toBeInstanceOf(
    AiUnavailableError,
  )
  expect(fn).toHaveBeenCalledTimes(2)
})

test('основная ответила — запасная не вызывается', async () => {
  const fn = vi.fn(async () => 'основная')

  await expect(withFallback(fn, 'main', { ...models(), timeoutMs: 100 })).resolves.toBe('основная')
  expect(fn).toHaveBeenCalledTimes(1)
})

test('модель задачи берётся из настроек зала', () => {
  applyModelSettings({
    chat: 'admin-chat',
    templates: 'admin-templates',
    exercises: 'admin-exercises',
    quick: 'admin-quick',
    fallback: 'admin-fallback',
  })

  expect(getModelName('main')).toBe('admin-chat')
  expect(getModelName('templates')).toBe('admin-templates')
  expect(getModelName('exercises')).toBe('admin-exercises')
  expect(getModelName('fast')).toBe('admin-quick')
  expect(getModelName('fallback')).toBe('admin-fallback')
})

test('без настроек для шаблонов используется модель по умолчанию', () => {
  applyModelSettings(undefined)
  expect(getModelName('templates')).toBe(DEFAULT_TEMPLATES_MODEL)
})

test('настройки перечитываются не чаще раза в 30 секунд; сбой чтения оставляет прежние', async () => {
  const loader = vi.fn(async () => ({ chat: 'from-db' }))

  await refreshModelOverrides(loader, 1_000_000)
  await refreshModelOverrides(loader, 1_000_000 + 29_000)
  expect(loader).toHaveBeenCalledTimes(1)
  expect(getModelName('main')).toBe('from-db')

  const broken = vi.fn(async () => {
    throw new Error('db down')
  })
  await refreshModelOverrides(broken, 1_000_000 + 31_000)
  expect(broken).toHaveBeenCalledTimes(1)
  expect(getModelName('main')).toBe('from-db')
})

test('модель по умолчанию для шаблонов — id, который указал владелец', () => {
  expect(defaultModelName('templates')).toBe('claude-opus-5.5')
})

test('список моделей провайдера: id по алфавиту; ответ не ok — понятная ошибка', async () => {
  const ok = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: [{ id: 'b-model' }, { id: 'a-model' }, { nope: 1 }] }), {
        status: 200,
      }),
  )
  await expect(listProviderModels(ok as unknown as typeof fetch)).resolves.toEqual(['a-model', 'b-model'])

  const bad = vi.fn(async () => new Response('forbidden', { status: 403 }))
  await expect(listProviderModels(bad as unknown as typeof fetch)).rejects.toThrow(/403/)
})
