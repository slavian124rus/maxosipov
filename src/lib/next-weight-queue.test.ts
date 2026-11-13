// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPendingNextWeights, postNextWeight } from './next-weight-queue'

const KEY = 'pending-next-weights'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('нет сети — вес попадает в очередь, потом досылается', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  await postNextWeight({ exerciseId: 'a', weightKg: 22 })
  expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([{ exerciseId: 'a', weightKg: 22 }])

  const ok = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', ok)
  await flushPendingNextWeights()
  expect(ok).toHaveBeenCalledTimes(1)
  expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([])
})

test('успешная отправка очередь не трогает; повтор по тому же упражнению заменяет вес', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  await postNextWeight({ exerciseId: 'a', weightKg: 20 })
  await postNextWeight({ exerciseId: 'a', weightKg: 25 })
  expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([{ exerciseId: 'a', weightKg: 25 }])
})
