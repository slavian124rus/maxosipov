import { expect, test } from 'vitest'
import type { MuscleCode } from '@/modules/catalog'
import { cycleMuscle, defaultView, type MuscleState } from './state'

const empty: MuscleState = { primary: [], secondary: [] }

test('defaultView: больше основных сзади → back', () => {
  expect(defaultView(['lats', 'traps-middle', 'biceps'])).toBe('back')
})

test('defaultView: при равенстве → front', () => {
  expect(defaultView(['lats', 'chest'])).toBe('front')
})

test('defaultView: пусто → front', () => {
  expect(defaultView([])).toBe('front')
})

test('cycleMuscle: нет → основная', () => {
  expect(cycleMuscle(empty, 'lats')).toEqual({ primary: ['lats'], secondary: [] })
})

test('cycleMuscle: основная → помогающая', () => {
  const state: MuscleState = { primary: ['lats'], secondary: [] }
  expect(cycleMuscle(state, 'lats')).toEqual({ primary: [], secondary: ['lats'] })
})

test('cycleMuscle: помогающая → убрать', () => {
  const state: MuscleState = { primary: [], secondary: ['lats'] }
  expect(cycleMuscle(state, 'lats')).toEqual({ primary: [], secondary: [] })
})

test('cycleMuscle: мышца из secondary убирается и не попадает в primary', () => {
  const state: MuscleState = { primary: ['chest'], secondary: ['lats'] }
  const next = cycleMuscle(state, 'lats')
  expect(next.primary).not.toContain('lats')
  expect(next.secondary).not.toContain('lats')
})

test('primary и secondary никогда не пересекаются', () => {
  let state = empty
  for (const code of ['lats', 'chest', 'lats', 'biceps', 'chest', 'chest'] as MuscleCode[]) {
    state = cycleMuscle(state, code)
    const intersection = state.primary.filter((item) => state.secondary.includes(item))
    expect(intersection).toEqual([])
  }
})

test('cycleMuscle не мутирует исходное состояние', () => {
  const state: MuscleState = { primary: ['chest'], secondary: [] }
  cycleMuscle(state, 'chest')
  expect(state).toEqual({ primary: ['chest'], secondary: [] })
})
