import { expect, test } from 'vitest'
import { alignSetWeights, initialSetWeight } from './set-weights'

test('план 15/20/20/20 и стартовый вес равен рабочему — план без изменений', () => {
  expect(alignSetWeights([15, 20, 20, 20], 20)).toEqual([15, 20, 20, 20])
})

test('прогрессия подняла рабочий вес до 22,5 — весь рисунок сдвигается на ту же разницу', () => {
  expect(alignSetWeights([15, 20, 20, 20], 22.5)).toEqual([17.5, 22.5, 22.5, 22.5])
})

test('сдвиг вниз не уходит в минус', () => {
  expect(alignSetWeights([5, 20], 10)).toEqual([0, 10])
})

test('без плана по подходам — null', () => {
  expect(alignSetWeights(null, 20)).toBeNull()
  expect(alignSetWeights([], 20)).toBeNull()
})

test('вес подхода берётся из плана по номеру подхода, а не с прошлого подхода', () => {
  const plan = [15, 20, 20, 20]
  expect(initialSetWeight(plan, 0, null, 20)).toBe(15)
  expect(initialSetWeight(plan, 1, 15, 20)).toBe(20)
})

test('без плана — вес прошлого подхода, а в первом подходе стартовый', () => {
  expect(initialSetWeight(null, 0, null, 30)).toBe(30)
  expect(initialSetWeight(null, 2, 32.5, 30)).toBe(32.5)
})

test('подходов больше, чем весов в плане (добавил лишний подход) — последний вес плана', () => {
  expect(initialSetWeight([15, 20], 3, 20, 20)).toBe(20)
})
