import { expect, test } from 'vitest'
import { formatStep, isNoWeight, parseWeightStep } from './machine-values'

test('parseWeightStep: запятая, точка, пробелы и пустое значение', () => {
  expect(parseWeightStep('2,5')).toBe(2.5)
  expect(parseWeightStep('2.5')).toBe(2.5)
  expect(parseWeightStep(' 5 ')).toBe(5)
  expect(parseWeightStep('')).toBe(5)
  expect(parseWeightStep('   ')).toBe(5)
})

test('parseWeightStep: мусор даёт NaN — форма покажет ошибку валидации', () => {
  expect(Number.isNaN(parseWeightStep('abc'))).toBe(true)
  expect(Number.isNaN(parseWeightStep(',,'))).toBe(true)
})

test('formatStep: шаг показываем с запятой', () => {
  expect(formatStep(2.5)).toBe('2,5')
  expect(formatStep(5)).toBe('5')
  expect(formatStep(1.25)).toBe('1,25')
})

test('parseWeightStep: «0» — это «без веса», а не ошибка', () => {
  expect(parseWeightStep('0')).toBe(0)
  expect(parseWeightStep('0,0')).toBe(0)
  expect(isNoWeight(parseWeightStep('0'))).toBe(true)
  expect(isNoWeight(parseWeightStep('2,5'))).toBe(false)
})

test('formatStep и parseWeightStep — обратные друг другу', () => {
  for (const value of [1, 2.5, 5, 10.5]) {
    expect(parseWeightStep(formatStep(value))).toBe(value)
  }
})
