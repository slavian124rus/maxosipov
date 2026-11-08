import { expect, test } from 'vitest'
import { recommend } from './recommend'
import type { ProgressionRules, SessionResult } from './types'

const rules: ProgressionRules = {
  sessionsToIncrease: 2,
  fastTrackOnEasy: true,
  failSessionsToDrop: 2,
  dropPercent: 10,
}

function session(
  weightKg: number,
  reps: number[],
  feeling: 'easy' | 'good' | 'hard' | null = 'good',
): SessionResult {
  return {
    date: new Date('2026-11-07T09:00:00Z'),
    sets: reps.map((value) => ({ weightKg, reps: value, feeling })),
  }
}

function run(history: SessionResult[], stepKg = 5, target = { sets: 3, repMin: 10, repMax: 12 }) {
  return recommend({ target, stepKg, history }, rules)
}

test('пустая история → none', () => {
  expect(run([])).toEqual({ action: 'none', weightKg: null, reasonCode: 'none' })
})

test('одна нормальная сессия → keep 50', () => {
  expect(run([session(50, [12, 12, 12])])).toEqual({
    action: 'keep',
    weightKg: 50,
    reasonCode: 'keep',
  })
})

test('две сессии подряд полностью → increase 55 по серии', () => {
  expect(run([session(50, [12, 12, 12]), session(50, [12, 12, 12])])).toEqual({
    action: 'increase',
    weightKg: 55,
    reasonCode: 'increase_streak',
  })
})

test('одна сессия все подходы «легко» → increase 55 сразу', () => {
  expect(run([session(50, [12, 12, 12], 'easy')])).toEqual({
    action: 'increase',
    weightKg: 55,
    reasonCode: 'increase_easy',
  })
})

test('при fastTrackOnEasy=false «легко» не ускоряет повышение', () => {
  const result = recommend(
    { target: { sets: 3, repMin: 10, repMax: 12 }, stepKg: 5, history: [session(50, [12, 12, 12], 'easy')] },
    { ...rules, fastTrackOnEasy: false },
  )
  expect(result).toEqual({ action: 'keep', weightKg: 50, reasonCode: 'keep' })
})

test('старшая сессия на другом весе → keep 50', () => {
  expect(run([session(50, [12, 12, 12]), session(45, [12, 12, 12])])).toEqual({
    action: 'keep',
    weightKg: 50,
    reasonCode: 'keep',
  })
})

test('«Тяжело» в одной из серий → keep', () => {
  expect(run([session(50, [12, 12, 12]), session(50, [12, 12, 12], 'hard')])).toEqual({
    action: 'keep',
    weightKg: 50,
    reasonCode: 'keep',
  })
})

test('два подхода из трёх → keep (не выполнен объём)', () => {
  expect(run([session(50, [12, 12], 'easy')])).toEqual({
    action: 'keep',
    weightKg: 50,
    reasonCode: 'keep',
  })
})

test('две сессии с недобором → decrease 45', () => {
  expect(run([session(50, [8, 9, 12]), session(50, [8, 9, 12])])).toEqual({
    action: 'decrease',
    weightKg: 45,
    reasonCode: 'decrease',
  })
})

test('100 кг, недобор → decrease 90 (шаг 5)', () => {
  expect(run([session(100, [6, 7, 8]), session(100, [6, 7, 8])])).toEqual({
    action: 'decrease',
    weightKg: 90,
    reasonCode: 'decrease',
  })
})

test('шаг 2,5: 32,5 с недобором → 27,5; с полным объёмом → 35', () => {
  expect(run([session(32.5, [8, 8, 8]), session(32.5, [8, 8, 8])], 2.5)).toEqual({
    action: 'decrease',
    weightKg: 27.5,
    reasonCode: 'decrease',
  })

  expect(run([session(32.5, [12, 12, 12]), session(32.5, [12, 12, 12])], 2.5)).toEqual({
    action: 'increase',
    weightKg: 35,
    reasonCode: 'increase_streak',
  })
})

test('одна провальная сессия → keep', () => {
  expect(run([session(50, [8, 8, 8])])).toEqual({
    action: 'keep',
    weightKg: 50,
    reasonCode: 'keep',
  })
})

test('разминка не мешает: рабочие подходы берутся по максимальному весу', () => {
  const history: SessionResult[] = [
    {
      date: new Date('2026-11-07T09:00:00Z'),
      sets: [
        { weightKg: 20, reps: 15, feeling: 'easy' },
        { weightKg: 50, reps: 12, feeling: 'good' },
        { weightKg: 50, reps: 12, feeling: 'good' },
        { weightKg: 50, reps: 12, feeling: 'good' },
      ],
    },
    {
      date: new Date('2026-11-05T09:00:00Z'),
      sets: [
        { weightKg: 20, reps: 15, feeling: 'easy' },
        { weightKg: 50, reps: 12, feeling: 'good' },
        { weightKg: 50, reps: 12, feeling: 'good' },
        { weightKg: 50, reps: 12, feeling: 'good' },
      ],
    },
  ]

  expect(run(history)).toEqual({ action: 'increase', weightKg: 55, reasonCode: 'increase_streak' })
})

test('2,5 кг с провалами → 0, а не отрицательный вес', () => {
  expect(run([session(2.5, [5, 5, 5]), session(2.5, [5, 5, 5])], 5)).toEqual({
    action: 'decrease',
    weightKg: 0,
    reasonCode: 'decrease',
  })
})

test('при шаге 0 рекомендации нет', () => {
  expect(run([session(50, [12, 12, 12])], 0)).toEqual({
    action: 'none',
    weightKg: null,
    reasonCode: 'none',
  })
})