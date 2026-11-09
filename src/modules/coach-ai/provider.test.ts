import { expect, test, vi } from 'vitest'
import type { LanguageModel } from 'ai'
import { AiUnavailableError, withFallback } from './provider'

const modelA = { modelId: 'main-model' } as unknown as LanguageModel
const modelB = { modelId: 'fallback-model' } as unknown as LanguageModel

function models(): { getModel: (kind: 'main' | 'fast' | 'fallback') => LanguageModel } {
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
