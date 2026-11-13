// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useMediaPlayback } from './use-media-playback'

const READY = { status: 'ready', playback: { mp4: '/m.mp4', webm: null, poster: '/p.jpg' } }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function stubFetch(...bodies: unknown[]) {
  const fetchMock = vi.fn()
  for (const body of bodies) fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('пока видео обрабатывается, статус сам обновляется до «готово» без перезагрузки', async () => {
  const fetchMock = stubFetch({ status: 'processing', playback: null }, READY)
  const { result } = renderHook(() =>
    useMediaPlayback('m1', { status: 'processing', mp4Url: null, webmUrl: null, posterUrl: null }),
  )

  await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
  expect(result.current?.status).toBe('processing')
  await act(async () => { await vi.advanceTimersByTimeAsync(3100) })

  expect(result.current).toEqual({ status: 'ready', mp4Url: '/m.mp4', webmUrl: null, posterUrl: '/p.jpg' })
  expect(fetchMock).toHaveBeenCalledWith('/api/media/m1')

  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(fetchMock).toHaveBeenCalledTimes(2) // после «готово» опрос остановлен
})

test('готовое видео не опрашивается совсем', async () => {
  const fetchMock = stubFetch()
  renderHook(() =>
    useMediaPlayback('m1', { status: 'ready', mp4Url: '/a.mp4', webmUrl: null, posterUrl: null }),
  )
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(fetchMock).not.toHaveBeenCalled()
})

test('новый mediaId после загрузки: сразу «обрабатывается», затем готово', async () => {
  stubFetch(READY)
  const { result, rerender } = renderHook(
    ({ id }: { id: string | null }) =>
      useMediaPlayback(id, { status: null, mp4Url: null, webmUrl: null, posterUrl: null }),
    { initialProps: { id: null as string | null } },
  )
  expect(result.current).toBeNull()
  rerender({ id: 'new' })
  expect(result.current?.status).toBe('processing')
  await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
  expect(result.current?.status).toBe('ready')
})
