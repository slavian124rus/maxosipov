import { expect, test } from 'vitest'
import { reviewExercise, sanitizeExerciseFix, type ExerciseReviewInput } from './exercise-review'

const GOOD: ExerciseReviewInput = {
  name: 'Жим ногами',
  machine: 'Платформа',
  primary: ['quads'],
  secondary: ['glutes'],
  steps: ['Сядь и прижми спину', 'Поставь стопы на платформу', 'Выжми и верни медленно'],
  mistakes: ['Отрыв пяток', 'Рывки'],
  tip: 'Колени по носкам',
  repMin: 10,
  repMax: 12,
  hasVideo: true,
  hasPhoto: true,
}

test('заполненная карточка — замечаний нет', () => {
  expect(reviewExercise(GOOD)).toEqual([])
})

test('пустые мышцы, шаги и перевёрнутые повторения — ошибки', () => {
  const issues = reviewExercise({ ...GOOD, primary: [], steps: [], repMin: 15, repMax: 10 })
  const errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.field)

  expect(errors).toContain('muscles')
  expect(errors).toContain('steps')
  expect(errors).toContain('reps')
})

test('короткое название — ошибка, длинное — предупреждение', () => {
  expect(reviewExercise({ ...GOOD, name: 'Жм' })[0]).toMatchObject({
    field: 'name',
    severity: 'error',
  })

  const long = reviewExercise({ ...GOOD, name: 'Ж'.repeat(80) })
  expect(long.some((issue) => issue.field === 'name' && issue.severity === 'warning')).toBe(true)
})

test('мышца одновременно основная и помогающая — предупреждение', () => {
  const issues = reviewExercise({ ...GOOD, secondary: ['quads'] })

  expect(issues.some((issue) => issue.text.includes('и основной, и помогающей'))).toBe(true)
})

test('мало шагов и повтор шага — предупреждения', () => {
  const issues = reviewExercise({ ...GOOD, steps: ['Сядь', 'Сядь'] })
  const texts = issues.map((issue) => issue.text)

  expect(texts.some((text) => text.includes('Шагов 2'))).toBe(true)
  expect(texts.some((text) => text.includes('Шаг повторяется'))).toBe(true)
})

test('слишком длинный шаг — предупреждение', () => {
  const issues = reviewExercise({
    ...GOOD,
    steps: ['Сядь и прижми спину', 'Поставь стопы', 'Ж'.repeat(160)],
  })

  expect(issues.some((issue) => issue.text.includes('длиннее 140'))).toBe(true)
})

test('нет ошибок, совета и медиа — предупреждения, но не ошибки', () => {
  const issues = reviewExercise({
    ...GOOD,
    mistakes: [],
    tip: null,
    hasVideo: false,
    hasPhoto: false,
  })

  expect(issues.every((issue) => issue.severity === 'warning')).toBe(true)
  expect(issues.map((issue) => issue.field)).toEqual(
    expect.arrayContaining(['mistakes', 'tip', 'media']),
  )
})

test('много повторений — предупреждение, вне 1–50 — ошибка', () => {
  expect(
    reviewExercise({ ...GOOD, repMin: 15, repMax: 25 }).some((issue) => issue.severity === 'warning'),
  ).toBe(true)
  expect(
    reviewExercise({ ...GOOD, repMin: 0, repMax: 12 }).some((issue) => issue.severity === 'error'),
  ).toBe(true)
})

test('sanitizeExerciseFix: неизвестные мышцы отбрасываются, повторы зажимаются', () => {
  const fix = sanitizeExerciseFix(
    {
      name: '  Жим ногами в платформе  ',
      repMin: 0,
      repMax: 999,
      steps: ['Шаг один', 'Шаг один', 'Шаг два'],
      mistakes: ['Ошибка'],
      tip: 'Совет',
      primary: ['quads', 'unknown-muscle'],
      secondary: ['quads', 'glutes'],
    },
    GOOD,
  )

  expect(fix.name).toBe('Жим ногами в платформе')
  expect(fix.repMin).toBe(1)
  expect(fix.repMax).toBe(50)
  // Повтор шага убран, тексты сохранены.
  expect(fix.steps).toEqual(['Шаг один', 'Шаг два'])
  expect(fix.primary).toEqual(['quads'])
  // Помогающая не дублирует основную.
  expect(fix.secondary).toEqual(['glutes'])
})

test('sanitizeExerciseFix: пустые поля не ломают карточку — остаются прежние', () => {
  const fix = sanitizeExerciseFix(
    {
      name: '',
      repMin: 10,
      repMax: 12,
      steps: [],
      mistakes: [],
      tip: '',
      primary: [],
      secondary: [],
    },
    GOOD,
  )

  expect(fix.name).toBe(GOOD.name)
  expect(fix.primary).toEqual(GOOD.primary)
  expect(fix.steps).toEqual([])
  expect(fix.tip).toBe('')
})

test('sanitizeExerciseFix: тексты обрезаются по лимитам', () => {
  const fix = sanitizeExerciseFix(
    {
      name: 'Ж'.repeat(120),
      repMin: 10,
      repMax: 12,
      steps: ['Ш'.repeat(200)],
      mistakes: ['О'.repeat(200)],
      tip: 'С'.repeat(300),
      primary: ['quads'],
      secondary: [],
    },
    GOOD,
  )

  expect(fix.name.length).toBe(60)
  expect(fix.steps[0]?.length).toBe(140)
  expect(fix.mistakes[0]?.length).toBe(120)
  expect(fix.tip.length).toBe(160)
})
