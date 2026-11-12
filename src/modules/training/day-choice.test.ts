import { expect, test } from 'vitest'
import { pickWorkoutDay } from './day-choice'

const DAYS = [
  { id: 'day-1', name: 'День 1 — ноги' },
  { id: 'day-2', name: 'День 2 — спина' },
  { id: 'day-3', name: 'День 3 — грудь' },
]

test('без выбора и без истории — первый день', () => {
  expect(pickWorkoutDay(DAYS, null)?.id).toBe('day-1')
})

test('следующий день после последней тренировки', () => {
  expect(pickWorkoutDay(DAYS, 'day-1')?.id).toBe('day-2')
  expect(pickWorkoutDay(DAYS, 'day-2')?.id).toBe('day-3')
})

test('после последнего дня круг замыкается на первый', () => {
  expect(pickWorkoutDay(DAYS, 'day-3')?.id).toBe('day-1')
})

test('выбор клиента важнее порядка', () => {
  expect(pickWorkoutDay(DAYS, 'day-1', 'day-3')?.id).toBe('day-3')
  // Даже если выбрали тот, что и так шёл следующим.
  expect(pickWorkoutDay(DAYS, 'day-2', 'day-3')?.id).toBe('day-3')
})

test('чужой или устаревший день игнорируется: откат к обычному порядку', () => {
  expect(pickWorkoutDay(DAYS, 'day-1', 'day-9')?.id).toBe('day-2')
  expect(pickWorkoutDay(DAYS, null, 'чужой-день')?.id).toBe('day-1')
  expect(pickWorkoutDay(DAYS, 'day-1', '')?.id).toBe('day-2')
  expect(pickWorkoutDay(DAYS, 'day-1', null)?.id).toBe('day-2')
})

test('пустая программа — пустой результат', () => {
  expect(pickWorkoutDay([], 'day-1', 'day-2')).toBeNull()
})

test('день последней тренировки из прошлой программы не мешает', () => {
  // Такого id в текущей программе нет — считаем, что истории нет.
  expect(pickWorkoutDay(DAYS, 'старый-день')?.id).toBe('day-1')
})
