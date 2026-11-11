import { expect, test } from 'vitest'
import { clientsLabel, exercisesLabel, machinesLabel, pluralRu } from './plural'

test('pluralRu: три формы по числу', () => {
  const forms = ['файл', 'файла', 'файлов'] as const

  expect(pluralRu(1, forms)).toBe('файл')
  expect(pluralRu(2, forms)).toBe('файла')
  expect(pluralRu(4, forms)).toBe('файла')
  expect(pluralRu(5, forms)).toBe('файлов')
  expect(pluralRu(0, forms)).toBe('файлов')
})

test('pluralRu: 11–14 — всегда «много», 21 — снова «один»', () => {
  const forms = ['файл', 'файла', 'файлов'] as const

  expect(pluralRu(11, forms)).toBe('файлов')
  expect(pluralRu(12, forms)).toBe('файлов')
  expect(pluralRu(14, forms)).toBe('файлов')
  expect(pluralRu(21, forms)).toBe('файл')
  expect(pluralRu(22, forms)).toBe('файла')
  expect(pluralRu(111, forms)).toBe('файлов')
  expect(pluralRu(101, forms)).toBe('файл')
})

test('pluralRu: отрицательные числа склоняются по модулю', () => {
  expect(pluralRu(-1, ['день', 'дня', 'дней'])).toBe('день')
  expect(pluralRu(-5, ['день', 'дня', 'дней'])).toBe('дней')
})

test('exercisesLabel и родственные подписи', () => {
  expect(exercisesLabel(1)).toBe('1 упражнение')
  expect(exercisesLabel(3)).toBe('3 упражнения')
  expect(exercisesLabel(12)).toBe('12 упражнений')
  expect(clientsLabel(1)).toBe('1 клиент')
  expect(clientsLabel(5)).toBe('5 клиентов')
  expect(machinesLabel(2)).toBe('2 тренажёра')
  expect(machinesLabel(21)).toBe('21 тренажёр')
})
