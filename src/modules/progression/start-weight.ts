/**
 * Стартовый вес упражнения по анкете клиента (DESIGN.md §8.3, ARCHITECTURE.md §10.1).
 *
 * Это подсказка, а не истина: тренер видит её в программе и правит. Формула прозрачная —
 * доля собственного веса тела по мышце, помноженная на опыт, пол, цель и возраст,
 * с округлением вниз до шага тренажёра. Ничего не угадываем без анкеты.
 */

export type StartWeightProfile = {
  sex: 'male' | 'female'
  birthYear: number
  heightCm: number
  weightKg: number
  goal: 'strength' | 'mass' | 'fat_loss' | 'health'
  experience: 'novice' | 'intermediate' | 'advanced'
  sessionsPerWeek: number
}

export type StartWeightExercise = {
  /** Основные мышцы упражнения — коды `MUSCLES`. */
  primary: readonly string[]
  /** Упражнение на тренажёре: у него есть шаг веса. */
  onMachine: boolean
  /** Шаг веса, кг. `0` — без веса (кардио, собственный вес). */
  stepKg: number
}

/**
 * Доля собственного веса тела: `machine` — на тренажёре, `free` — свободные веса
 * (штанга/гантели требуют чуть больше из-за стабилизации).
 */
const GROUPS: Record<string, { machine: number; free: number }> = {
  quads: { machine: 0.5, free: 0.6 },
  hamstrings: { machine: 0.4, free: 0.5 },
  glutes: { machine: 0.45, free: 0.55 },
  'glutes-medius': { machine: 0.25, free: 0.3 },
  adductors: { machine: 0.25, free: 0.3 },
  lats: { machine: 0.4, free: 0.45 },
  rhomboids: { machine: 0.3, free: 0.35 },
  'traps-middle': { machine: 0.3, free: 0.35 },
  'traps-upper': { machine: 0.2, free: 0.25 },
  teres: { machine: 0.25, free: 0.3 },
  'lower-back': { machine: 0.3, free: 0.4 },
  chest: { machine: 0.35, free: 0.4 },
  serratus: { machine: 0.15, free: 0.15 },
  'delts-front': { machine: 0.2, free: 0.22 },
  'delts-side': { machine: 0.15, free: 0.16 },
  'delts-rear': { machine: 0.12, free: 0.14 },
  biceps: { machine: 0.12, free: 0.14 },
  triceps: { machine: 0.15, free: 0.17 },
  brachialis: { machine: 0.1, free: 0.12 },
  'forearms-flexors': { machine: 0.08, free: 0.1 },
  'forearms-extensors': { machine: 0.08, free: 0.1 },
  calves: { machine: 0.25, free: 0.3 },
  tibialis: { machine: 0.1, free: 0.12 },
  // Пресс, косые, шея, сгибатели бедра — работа с собственным весом: блины не подсказываем.
  abs: { machine: 0, free: 0 },
  obliques: { machine: 0, free: 0 },
  neck: { machine: 0, free: 0 },
  'hip-flexors': { machine: 0, free: 0 },
}

const EXPERIENCE: Record<StartWeightProfile['experience'], number> = {
  novice: 0.6,
  intermediate: 0.8,
  advanced: 1,
}

const GOAL: Record<StartWeightProfile['goal'], number> = {
  strength: 1,
  mass: 1.05,
  fat_loss: 0.9,
  health: 0.85,
}

function ageFactor(birthYear: number, now = new Date()): number {
  const age = now.getFullYear() - birthYear
  if (age >= 60) return 0.75
  if (age >= 50) return 0.85
  return 1
}

/** Очень низкий или очень высокий ИМТ — стартуем аккуратнее. */
function bmiFactor(heightCm: number, weightKg: number): number {
  if (heightCm <= 0) return 1

  const bmi = weightKg / (heightCm / 100) ** 2
  if (bmi >= 30) return 0.9
  if (bmi < 18.5) return 0.9
  return 1
}

/** Максимальная доля среди основных мышц: в сложном движении нагрузку задаёт крупная группа. */
function baseShare(exercise: StartWeightExercise): number {
  const key = exercise.onMachine ? 'machine' : 'free'
  let share = 0

  for (const code of exercise.primary) {
    share = Math.max(share, GROUPS[code]?.[key] ?? 0)
  }

  return share
}

/**
 * Стартовый вес: `0` — если нет анкеты, шаг веса 0 или упражнение с собственным весом.
 * Округление вниз до шага тренажёра: обещанного веса не должно быть на тренажёре невозможно
 * набрать (2,5 кг у блочных, 5 кг у стоек).
 */
export function estimateStartWeight(
  exercise: StartWeightExercise,
  profile: StartWeightProfile | null,
): number {
  if (!profile) return 0
  if (!Number.isFinite(exercise.stepKg) || exercise.stepKg <= 0) return 0

  const share = baseShare(exercise)
  if (share <= 0) return 0

  const raw =
    profile.weightKg *
    share *
    EXPERIENCE[profile.experience] *
    (profile.sex === 'female' ? 0.75 : 1) *
    GOAL[profile.goal] *
    ageFactor(profile.birthYear) *
    bmiFactor(profile.heightCm, profile.weightKg)

  if (!Number.isFinite(raw) || raw <= 0) return 0

  const step = exercise.stepKg
  const rounded = Math.floor(raw / step + 1e-9) * step

  // Меньше одного шага — не подсказываем вовсе: пусть тренер решит сам.
  if (rounded < step) return 0

  return Math.min(250, Math.round(rounded * 100) / 100)
}

/** Веса для набора упражнений: ключ — `exerciseId`, повтор одного упражнения считается один раз. */
export function estimateProgramWeights(
  exercises: { exerciseId: string; hint: StartWeightExercise }[],
  profile: StartWeightProfile | null,
): Record<string, number> {
  const result: Record<string, number> = {}

  for (const item of exercises) {
    if (result[item.exerciseId] !== undefined) continue

    const weight = estimateStartWeight(item.hint, profile)
    if (weight > 0) result[item.exerciseId] = weight
  }

  return result
}
