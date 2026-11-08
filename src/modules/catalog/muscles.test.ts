import { describe, expect, test } from 'vitest'
import { MUSCLES, muscleName, muscleView, svgLayerId } from './muscles'

test('27 мышц, все коды уникальны', () => {
  expect(MUSCLES).toHaveLength(27)
  expect(new Set(MUSCLES.map((muscle) => muscle.code)).size).toBe(27)
})

test('15 спереди и 12 сзади', () => {
  expect(MUSCLES.filter((muscle) => muscle.view === 'front')).toHaveLength(15)
  expect(MUSCLES.filter((muscle) => muscle.view === 'back')).toHaveLength(12)
})

test('id слоя = m-<code>', () => {
  for (const muscle of MUSCLES) {
    expect(svgLayerId(muscle.code)).toBe(`m-${muscle.code}`)
  }
})

test('коды и названия — ровно как в DESIGN §6.3', () => {
  expect(muscleName('lats')).toBe('Широчайшие')
  expect(muscleName('traps-upper')).toBe('Верх трапеций')
  expect(muscleName('glutes-medius')).toBe('Средняя ягодичная')
  expect(muscleView('lats')).toBe('back')
  expect(muscleView('chest')).toBe('front')
})

describe('muscleName', () => {
  test('неизвестный код возвращается как есть', () => {
    expect(muscleName('unknown-code')).toBe('unknown-code')
  })
})
