import { expect, test } from 'vitest'
import { estimateProgramWeights, estimateStartWeight, type StartWeightProfile } from './start-weight'

const YEAR = new Date().getFullYear()

const NOVICE_MALE: StartWeightProfile = {
  sex: 'male',
  birthYear: YEAR - 30,
  heightCm: 180,
  weightKg: 80,
  goal: 'fat_loss',
  experience: 'novice',
  sessionsPerWeek: 3,
}

const LEGS_MACHINE = { primary: ['quads'], onMachine: true, stepKg: 5 }
const CHEST_MACHINE = { primary: ['chest'], onMachine: true, stepKg: 2.5 }
const BICEPS_MACHINE = { primary: ['biceps'], onMachine: true, stepKg: 2.5 }
const ABS_MACHINE = { primary: ['abs'], onMachine: true, stepKg: 5 }

test('новичок: ноги на тренажёре — 20 кг, грудь — 15, бицепс — 5', () => {
  expect(estimateStartWeight(LEGS_MACHINE, NOVICE_MALE)).toBe(20)
  expect(estimateStartWeight(CHEST_MACHINE, NOVICE_MALE)).toBe(15)
  expect(estimateStartWeight(BICEPS_MACHINE, NOVICE_MALE)).toBe(5)
})

test('пресс и собственный вес — 0 кг, блины не подсказываем', () => {
  expect(estimateStartWeight(ABS_MACHINE, NOVICE_MALE)).toBe(0)
  expect(estimateStartWeight({ primary: ['abs'], onMachine: false, stepKg: 2.5 }, NOVICE_MALE)).toBe(0)
})

test('кардио без шага веса — 0 кг', () => {
  expect(estimateStartWeight({ primary: ['quads'], onMachine: true, stepKg: 0 }, NOVICE_MALE)).toBe(0)
})

test('без анкеты вес не выдумываем', () => {
  expect(estimateStartWeight(LEGS_MACHINE, null)).toBe(0)
})

test('женщина поднимает меньше при тех же данных', () => {
  const female: StartWeightProfile = { ...NOVICE_MALE, sex: 'female' }

  expect(estimateStartWeight(LEGS_MACHINE, female)).toBe(15)
  expect(estimateStartWeight(LEGS_MACHINE, NOVICE_MALE)).toBe(20)
})

test('опытный со целью «сила» получает заметно больше новичка', () => {
  const advanced: StartWeightProfile = {
    ...NOVICE_MALE,
    experience: 'advanced',
    goal: 'strength',
  }

  expect(estimateStartWeight(LEGS_MACHINE, advanced)).toBe(40)
})

test('после 60 лет вес ниже', () => {
  const senior: StartWeightProfile = { ...NOVICE_MALE, birthYear: YEAR - 62 }

  expect(estimateStartWeight(LEGS_MACHINE, senior)).toBe(15)
})

test('вес всегда кратен шагу тренажёра', () => {
  const weight = estimateStartWeight({ primary: ['lats'], onMachine: true, stepKg: 2.5 }, NOVICE_MALE)

  expect(weight % 2.5).toBe(0)
})

test('несколько основных мышц — берём крупную группу', () => {
  const compound = { primary: ['chest', 'triceps'], onMachine: true, stepKg: 2.5 }

  expect(estimateStartWeight(compound, NOVICE_MALE)).toBe(
    estimateStartWeight(CHEST_MACHINE, NOVICE_MALE),
  )
})

test('estimateProgramWeights: ключ — упражнение, повторы и нули не попадают', () => {
  const weights = estimateProgramWeights(
    [
      { exerciseId: 'gakk', hint: LEGS_MACHINE },
      { exerciseId: 'gakk', hint: LEGS_MACHINE },
      { exerciseId: 'abs', hint: ABS_MACHINE },
      { exerciseId: 'bench', hint: CHEST_MACHINE },
    ],
    NOVICE_MALE,
  )

  expect(weights).toEqual({ gakk: 20, bench: 15 })
})
