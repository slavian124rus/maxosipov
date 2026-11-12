import { expect, test } from 'vitest'
import { sanitizeWeightSuggestions, type WeightExerciseInput } from './start-weights'

const EXERCISES: WeightExerciseInput[] = [
  {
    exerciseId: 'gakk',
    name: 'Гакк-приседания',
    machineName: 'Гакк-машина',
    primary: ['quads'],
    stepKg: 5,
    sets: 3,
    repMin: 10,
    repMax: 12,
  },
  {
    exerciseId: 'abs',
    name: 'Скручивания',
    machineName: null,
    primary: ['abs'],
    stepKg: 2.5,
    sets: 3,
    repMin: 15,
    repMax: 20,
  },
]

test('вес округляется до шага тренажёра', () => {
  const items = sanitizeWeightSuggestions(
    { items: [{ exerciseId: 'gakk', weightKg: 22, reason: 'новичок' }] },
    EXERCISES,
  )

  expect(items).toEqual([{ exerciseId: 'gakk', weightKg: 20, reason: 'новичок' }])
})

test('неизвестное упражнение и повтор отбрасываются', () => {
  const items = sanitizeWeightSuggestions(
    {
      items: [
        { exerciseId: 'unknown', weightKg: 30, reason: '—' },
        { exerciseId: 'gakk', weightKg: 30, reason: 'первый' },
        { exerciseId: 'gakk', weightKg: 40, reason: 'второй' },
      ],
    },
    EXERCISES,
  )

  expect(items).toEqual([{ exerciseId: 'gakk', weightKg: 30, reason: 'первый' }])
})

test('отрицательный вес и мусор в причине не ломают предпросмотр', () => {
  const items = sanitizeWeightSuggestions(
    { items: [{ exerciseId: 'gakk', weightKg: -10, reason: '   ' }] },
    EXERCISES,
  )

  expect(items).toEqual([{ exerciseId: 'gakk', weightKg: 0, reason: 'по анкете' }])
})

test('слишком большой вес ограничен разумным максимумом', () => {
  const items = sanitizeWeightSuggestions(
    { items: [{ exerciseId: 'gakk', weightKg: 900, reason: 'много' }] },
    EXERCISES,
  )

  expect(items[0]?.weightKg).toBe(250)
})

test('упражнение без шага веса получает 0', () => {
  const items = sanitizeWeightSuggestions(
    { items: [{ exerciseId: 'abs', weightKg: 10, reason: 'пресс' }] },
    [{ ...EXERCISES[1]!, stepKg: 0 }],
  )

  expect(items[0]?.weightKg).toBe(0)
})
