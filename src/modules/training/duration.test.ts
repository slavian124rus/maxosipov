import { expect, test } from 'vitest'
import { formatDuration } from '@/shared/scheme'
import { estimateDayMinutes } from './duration'

const item = (sets: number, repMin: number, repMax: number, restSec: number) => ({
  sets,
  repMin,
  repMax,
  restSec,
})

test('пустой день — 0', () => {
  expect(estimateDayMinutes({ exercises: [] })).toBe(0)
  expect(formatDuration(0)).toBe('')
})

test('одно упражнение: 4×10 с отдыхом 90 с ≈ 10 минут', () => {
  // 4*10*3=120 + 3*90=270 + 60 = 450 c = 7,5 мин → 10 (округление до 5)
  expect(estimateDayMinutes({ exercises: [item(4, 10, 10, 90)] })).toBe(10)
})

test('день из шести упражнений и разминка 6 минут', () => {
  const day = { exercises: Array.from({ length: 6 }, () => item(3, 10, 12, 90)) }
  // на упражнение: 3*11*3=99 + 2*90=180 + 60 = 339 c → 6*339 = 2034 c = 33,9 мин, + 6 = 39,9 → 40
  expect(estimateDayMinutes(day, { warmupMin: 6 })).toBe(40)
  expect(formatDuration(40)).toBe('≈ 40 мин')
})

test('больше отдых — дольше тренировка', () => {
  const short = estimateDayMinutes({ exercises: [item(4, 8, 10, 60)] })
  const long = estimateDayMinutes({ exercises: [item(4, 8, 10, 180)] })
  expect(long).toBeGreaterThan(short)
})
