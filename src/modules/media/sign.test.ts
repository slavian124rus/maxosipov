import { expect, test } from 'vitest'
import { PHOTO_URL_TTL_SEC, signMediaPath, verifyMediaRequest, VIDEO_URL_TTL_SEC } from './sign'

const REL = '2026/11/abc/video.mp4'
const NOW = new Date('2026-11-07T09:00:00Z')

function partsOf(url: string): { exp: number; sig: string } {
  const parsed = new URL(url, 'https://app.maxosipov.ru')
  return { exp: Number(parsed.searchParams.get('exp')), sig: parsed.searchParams.get('sig') ?? '' }
}

test('валидная подпись проходит', () => {
  const url = signMediaPath(REL, VIDEO_URL_TTL_SEC, NOW)
  const { exp, sig } = partsOf(url)
  expect(verifyMediaRequest(REL, exp, sig, NOW)).toBe(true)
})

test('ссылка ведёт на /media/<path>', () => {
  expect(signMediaPath(REL, 600, NOW).startsWith(`/media/${REL}?`)).toBe(true)
})

test('изменённый путь не проходит', () => {
  const { exp, sig } = partsOf(signMediaPath(REL, 600, NOW))
  expect(verifyMediaRequest('2026/11/abc/other.mp4', exp, sig, NOW)).toBe(false)
})

test('изменённый exp не проходит', () => {
  const { exp, sig } = partsOf(signMediaPath(REL, 600, NOW))
  expect(verifyMediaRequest(REL, exp + 60, sig, NOW)).toBe(false)
})

test('истёкшая ссылка не проходит', () => {
  const { exp, sig } = partsOf(signMediaPath(REL, PHOTO_URL_TTL_SEC, NOW))
  const later = new Date(NOW.getTime() + (PHOTO_URL_TTL_SEC + 1) * 1000)
  expect(verifyMediaRequest(REL, exp, sig, later)).toBe(false)
})

test('мусор вместо подписи не проходит', () => {
  const { exp } = partsOf(signMediaPath(REL, 600, NOW))
  expect(verifyMediaRequest(REL, exp, 'deadbeef', NOW)).toBe(false)
  expect(verifyMediaRequest(REL, Number.NaN, 'x', NOW)).toBe(false)
})
