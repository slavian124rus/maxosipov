import { expect, test } from 'vitest'
import { recommendBodyweight } from './bodyweight'

const target = { sets: 3, repMin: 12, repMax: 15 }
const session = (reps: number[]) => ({
  date: new Date(),
  sets: reps.map((count) => ({ weightKg: 0, reps: count, feeling: null })),
})

test('без истории — просто «сделай столько-то», без килограммов', () => {
  const result = recommendBodyweight({ target, history: [] })
  expect(result.action).toBe('none')
  expect(result.text).toContain('12–15')
  expect(result.text).not.toContain('кг')
})

test('одна тренировка с максимумом — ещё рано усложнять', () => {
  expect(recommendBodyweight({ target, history: [session([15, 15, 15])] }).action).toBe('keep')
})

test('две тренировки подряд с максимумом — пора усложнить, совет из карточки', () => {
  const result = recommendBodyweight({
    target,
    history: [session([15, 15, 15]), session([16, 15, 15])],
    tip: 'Сложнее — на одной ноге',
  })
  expect(result.action).toBe('increase')
  expect(result.text).toContain('на одной ноге')
})

test('не добил в одном подходе — держим', () => {
  const result = recommendBodyweight({ target, history: [session([15, 14, 15]), session([15, 15, 15])] })
  expect(result.action).toBe('keep')
  expect(result.text).toContain('15')
})

test('с отягощением — совет добавить вес', () => {
  const result = recommendBodyweight({
    target,
    canAddWeight: true,
    history: [session([15, 15, 15]), session([15, 15, 15])],
  })
  expect(result.text).toContain('отягощение')
})
