import { expect, test } from 'vitest'
import { formatWeight, recommendationText } from './text'

const NBSP = '\u00A0'

test('formatWeight: целый и дробный вес', () => {
  expect(formatWeight(35)).toBe(`35${NBSP}кг`)
  expect(formatWeight(32.5)).toBe(`32,5${NBSP}кг`)
})

test.each([
  ['increase_streak', 55, `Сегодня 55${NBSP}кг — две тренировки подряд все подходы сделаны`],
  ['increase_easy', 55, `Сегодня 55${NBSP}кг — в прошлый раз все подходы были легко`],
  ['keep', 32.5, `Оставляем 32,5${NBSP}кг — добиваем 12 повторений во всех подходах`],
  ['decrease', 30, `Сегодня 30${NBSP}кг — восстановим технику и вернёмся`],
] as const)('%s → текст DESIGN §9.2', (reasonCode, weightKg, expected) => {
  expect(
    recommendationText({ action: 'keep', weightKg, reasonCode }, { repMax: 12 }),
  ).toBe(expected)
})

test('none → «Подбери рабочий вес…»', () => {
  expect(
    recommendationText({ action: 'none', weightKg: null, reasonCode: 'none' }, { repMax: 12 }),
  ).toBe('Подбери рабочий вес: 10–12 повторений с запасом 2')
})