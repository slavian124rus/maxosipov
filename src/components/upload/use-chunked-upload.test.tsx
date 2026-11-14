// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useChunkedUpload } from './use-chunked-upload'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const json = (body: unknown) => ({ ok: true, json: async () => body })
const FILE = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' })

async function run(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useChunkedUpload())
  let id: string | null = null
  const pending = act(async () => {
    const promise = result.current.upload(FILE, 'machine_photo')
    await vi.advanceTimersByTimeAsync(20000)
    id = await promise
  })
  await pending
  return { id, result }
}

test('обрыв сети на первом запросе («Failed to fetch») не роняет загрузку — повторяем', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(json({ id: 'm1', chunkSize: 5_000_000, totalChunks: 1 }))
    .mockResolvedValueOnce(json({ received_chunks: [] }))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce(json({}))

  const { id, result } = await run(fetchMock)
  expect(id).toBe('m1')
  expect(result.current.error).toBeNull()
})

test('если сети нет совсем, показываем понятное сообщение, а не «Failed to fetch»', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
  const { id, result } = await run(fetchMock)
  expect(id).toBeNull()
  expect(result.current.error).toBe('Нет связи с сервером. Проверь интернет и попробуй ещё раз')
})
