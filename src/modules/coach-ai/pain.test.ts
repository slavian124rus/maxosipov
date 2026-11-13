import { expect, test } from 'vitest'
import { checkDraftPainSafety, checkPainSafety, mentionsClearance, painZones } from './pain'

test('зоны жалобы выделяются по словам клиента', () => {
  expect(painZones('Болит поясница и колено')).toEqual(['back', 'knee'])
  expect(painZones('Мне как-то плохо, тошнит')).toEqual(['general'])
})

test('фразы о том, что боль прошла или Максим разрешил', () => {
  expect(mentionsClearance('Максим посмотрел спину, всё ок, замени становую')).toBe(true)
  expect(mentionsClearance('Максим сказал можно')).toBe(true)
  expect(mentionsClearance('Болит спина')).toBe(false)
})

const tree = {
  days: [
    {
      exercises: [
        { id: 'p1', exerciseId: 'deadlift', sets: 3, repMax: 10, targetWeightKg: 60 },
        { id: 'p2', exerciseId: 'curl', sets: 3, repMax: 12, targetWeightKg: 10 },
      ],
    },
  ],
}
const muscles: Record<string, string[]> = {
  deadlift: ['lower-back', 'glutes'],
  curl: ['biceps'],
  legpress: ['quads'],
  hyper: ['lower-back'],
}
const musclesOf = (id: string) => muscles[id] ?? []
const back = { zones: ['back' as const] }

test('при боли в спине нельзя добавить или поставить упражнение на поясницу', () => {
  expect(checkPainSafety([{ op: 'add_exercise', exerciseId: 'hyper' }], tree, back, musclesOf)).toContain('жалоба')
  expect(
    checkPainSafety([{ op: 'replace_exercise', programExerciseId: 'p2', exerciseId: 'hyper' }], tree, back, musclesOf),
  ).not.toBeNull()
})

test('удалить, заменить на упражнение вне зоны и снизить вес можно', () => {
  expect(checkPainSafety([{ op: 'remove_exercise' }], tree, back, musclesOf)).toBeNull()
  expect(
    checkPainSafety([{ op: 'replace_exercise', programExerciseId: 'p1', exerciseId: 'legpress' }], tree, back, musclesOf),
  ).toBeNull()
  expect(
    checkPainSafety([{ op: 'set_target_weight', programExerciseId: 'p1', weightKg: 40 }], tree, back, musclesOf),
  ).toBeNull()
})

test('увеличение веса или подходов на больной зоне запрещено, вне зоны — нет', () => {
  expect(
    checkPainSafety([{ op: 'set_target_weight', programExerciseId: 'p1', weightKg: 70 }], tree, back, musclesOf),
  ).not.toBeNull()
  expect(
    checkPainSafety([{ op: 'set_sets_reps', programExerciseId: 'p1', sets: 5 }], tree, back, musclesOf),
  ).not.toBeNull()
  expect(
    checkPainSafety([{ op: 'set_target_weight', programExerciseId: 'p2', weightKg: 12 }], tree, back, musclesOf),
  ).toBeNull()
})

test('без открытых жалоб ограничений нет', () => {
  expect(checkPainSafety([{ op: 'add_exercise', exerciseId: 'hyper' }], tree, { zones: [] }, musclesOf)).toBeNull()
})

test('общая жалоба запрещает любое повышение нагрузки', () => {
  expect(
    checkPainSafety([{ op: 'set_target_weight', programExerciseId: 'p2', weightKg: 12 }], tree, { zones: ['general'] }, musclesOf),
  ).not.toBeNull()
})

test('черновик новой программы без упражнений на больную зону проходит', () => {
  expect(checkDraftPainSafety(['legpress', 'curl'], back, musclesOf)).toBeNull()
  expect(checkDraftPainSafety(['legpress', 'hyper'], back, musclesOf)).not.toBeNull()
})
