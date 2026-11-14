import { randomUUID } from 'node:crypto'
import { z } from 'zod'

export type ProgramTreeExercise = {
  id: string
  order: number
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  targetWeightKg: number | null
  /** Вес по подходам (1-й подход 15, остальные по 20); `null` — один вес на все подходы. */
  setWeights: number[] | null
  note: string | null
}

export type ProgramTreeDay = {
  id: string
  order: number
  name: string
  exercises: ProgramTreeExercise[]
}

export type ProgramTree = {
  id: string
  ownerId: string | null
  authorKind: 'trainer' | 'client' | 'client_ai'
  name: string
  status: 'active' | 'archived'
  /** Только у шаблонов: для кого, цель и номер в зале. */
  audience?: 'any' | 'male' | 'female' | null
  goal?: 'strength' | 'mass' | 'fat_loss' | 'health' | null
  templateNumber?: number | null
  days: ProgramTreeDay[]
}

export class PatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatchError'
  }
}

const id = z.string().uuid()
const sets = z.number().int().min(1).max(10)
const reps = z.number().int().min(1).max(100)
const restSec = z.number().int().min(0).max(600)

const opSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_exercise'),
    dayId: id,
    exerciseId: id,
    sets,
    repMin: reps,
    repMax: reps,
    restSec: restSec.optional(),
    afterId: id.optional(),
  }),
  z.object({ op: z.literal('remove_exercise'), programExerciseId: id }),
  z.object({ op: z.literal('replace_exercise'), programExerciseId: id, exerciseId: id }),
  z.object({
    op: z.literal('set_sets_reps'),
    programExerciseId: id,
    sets: sets.optional(),
    repMin: reps.optional(),
    repMax: reps.optional(),
    restSec: restSec.optional(),
  }),
  z.object({
    op: z.literal('set_target_weight'),
    programExerciseId: id,
    weightKg: z.number().min(0).max(1000).nullable(),
  }),
  z.object({
    op: z.literal('set_set_weights'),
    programExerciseId: id,
    /** По одному весу на подход; `null` — вернуть один вес на все подходы. */
    weights: z.array(z.number().min(0).max(1000)).min(1).max(10).nullable(),
  }),
  z.object({
    op: z.literal('set_note'),
    programExerciseId: id,
    note: z.string().trim().max(200).nullable(),
  }),
  z.object({ op: z.literal('reorder'), dayId: id, orderedIds: z.array(id).min(1) }),
  z.object({
    op: z.literal('add_day'),
    name: z.string().trim().min(1).max(80),
    afterDayId: id.optional(),
    /** Свой id нового дня: так упражнения можно добавить в него в том же патче. */
    dayId: id.optional(),
  }),
  z.object({ op: z.literal('rename_day'), dayId: id, name: z.string().trim().min(1).max(80) }),
  /**
   * Удаление дня вместе с его упражнениями. Уже выполненные тренировки остаются:
   * `workout_sessions.program_day_id` — просто uuid без внешнего ключа, история не рушится.
   */
  z.object({ op: z.literal('delete_day'), dayId: id }),
])

/** Патч программы — 1–20 операций, проверяется до показа клиенту. */
export const programPatchSchema = z.object({ ops: z.array(opSchema).min(1).max(20) })

export type ProgramPatch = z.infer<typeof programPatchSchema>
export type ProgramPatchOp = ProgramPatch['ops'][number]

/** «3 подхода · 10–12 раз» / «3 подхода · 10 раз». */
import { formatScheme } from '@/shared/scheme'

export { formatScheme }

function clone(tree: ProgramTree): ProgramTree {
  return {
    ...tree,
    days: tree.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((item) => ({ ...item })),
    })),
  }
}

function reindex(tree: ProgramTree): void {
  tree.days.forEach((day, dayIndex) => {
    day.order = dayIndex + 1
    day.exercises.forEach((item, index) => {
      item.order = index + 1
    })
  })
}

/** Подгоняет веса под число подходов: лишние отрезает, недостающие повторяют последний. */
function fitWeights(weights: number[], sets: number): number[] {
  if (weights.length === sets) return weights
  if (weights.length > sets) return weights.slice(0, sets)
  return [...weights, ...Array(sets - weights.length).fill(weights[weights.length - 1])]
}

function findDay(tree: ProgramTree, dayId: string): ProgramTreeDay {
  const day = tree.days.find((item) => item.id === dayId)
  if (!day) throw new PatchError('Дня нет в программе')
  return day
}

function findExercise(
  tree: ProgramTree,
  programExerciseId: string,
): { day: ProgramTreeDay; item: ProgramTreeExercise } {
  for (const day of tree.days) {
    const item = day.exercises.find((entry) => entry.id === programExerciseId)
    if (item) return { day, item }
  }
  throw new PatchError('Упражнения нет в программе')
}

function assertPublished(published: Set<string>, exerciseId: string): void {
  if (!published.has(exerciseId)) throw new PatchError('Такого упражнения нет в каталоге зала')
}

function assertReps(repMin: number, repMax: number): void {
  if (repMin > repMax) throw new PatchError('Минимум повторений больше максимума')
}

/**
 * Применяет патч к дереву программы. Возвращает новое дерево, исходное не меняется;
 * в БД не ходит (список опубликованных упражнений передаётся снаружи).
 */
export function applyPatch(
  tree: ProgramTree,
  patch: ProgramPatch,
  publishedExerciseIds: Set<string>,
): ProgramTree {
  const parsed = programPatchSchema.parse(patch)
  const next = clone(tree)

  for (const op of parsed.ops) {
    if (op.op === 'add_exercise') {
      const day = findDay(next, op.dayId)
      assertPublished(publishedExerciseIds, op.exerciseId)
      assertReps(op.repMin, op.repMax)

      const created: ProgramTreeExercise = {
        id: randomUUID(),
        order: day.exercises.length + 1,
        exerciseId: op.exerciseId,
        sets: op.sets,
        repMin: op.repMin,
        repMax: op.repMax,
        restSec: op.restSec ?? 90,
        targetWeightKg: null,
        setWeights: null,
        note: null,
      }

      const afterIndex = op.afterId
        ? day.exercises.findIndex((item) => item.id === op.afterId)
        : -1

      if (afterIndex >= 0) day.exercises.splice(afterIndex + 1, 0, created)
      else day.exercises.push(created)
    }

    if (op.op === 'remove_exercise') {
      const { day, item } = findExercise(next, op.programExerciseId)
      day.exercises = day.exercises.filter((entry) => entry.id !== item.id)
    }

    if (op.op === 'replace_exercise') {
      const { item } = findExercise(next, op.programExerciseId)
      assertPublished(publishedExerciseIds, op.exerciseId)
      item.exerciseId = op.exerciseId
      // Вес прежнего упражнения к новому не относится: его подберёт resolvePlanWeights.
      item.targetWeightKg = null
      item.setWeights = null
    }

    if (op.op === 'set_sets_reps') {
      const { item } = findExercise(next, op.programExerciseId)
      const repMin = op.repMin ?? item.repMin
      const repMax = op.repMax ?? item.repMax
      assertReps(repMin, repMax)
      item.repMin = repMin
      item.repMax = repMax
      if (op.sets !== undefined) item.sets = op.sets
      if (op.restSec !== undefined) item.restSec = op.restSec
      if (item.setWeights) item.setWeights = fitWeights(item.setWeights, item.sets)
    }

    if (op.op === 'set_target_weight') {
      const { item } = findExercise(next, op.programExerciseId)
      item.targetWeightKg = op.weightKg
      item.setWeights = null
    }

    if (op.op === 'set_set_weights') {
      const { item } = findExercise(next, op.programExerciseId)

      if (op.weights === null) {
        item.setWeights = null
      } else {
        if (op.weights.length !== item.sets) {
          throw new PatchError(`Весов ${op.weights.length}, а подходов ${item.sets}: нужно по одному на подход`)
        }
        item.setWeights = op.weights
        // Рабочий вес для прогрессии и плана — самый тяжёлый подход.
        item.targetWeightKg = Math.max(...op.weights)
      }
    }

    if (op.op === 'set_note') {
      const { item } = findExercise(next, op.programExerciseId)
      item.note = op.note
    }

    if (op.op === 'reorder') {
      const day = findDay(next, op.dayId)
      const current = new Set(day.exercises.map((item) => item.id))
      const ordered = new Set(op.orderedIds)

      if (current.size !== ordered.size || [...current].some((item) => !ordered.has(item))) {
        throw new PatchError('Порядок должен содержать все упражнения дня')
      }

      day.exercises = op.orderedIds.map((item) => day.exercises.find((e) => e.id === item)!)
    }

    if (op.op === 'add_day') {
      if (op.dayId && next.days.some((day) => day.id === op.dayId)) {
        throw new PatchError('День с таким id уже есть')
      }

      const created: ProgramTreeDay = {
        id: op.dayId ?? randomUUID(),
        order: next.days.length + 1,
        name: op.name,
        exercises: [],
      }

      const afterIndex = op.afterDayId
        ? next.days.findIndex((day) => day.id === op.afterDayId)
        : -1

      if (afterIndex >= 0) next.days.splice(afterIndex + 1, 0, created)
      else next.days.push(created)
    }

    if (op.op === 'rename_day') {
      findDay(next, op.dayId).name = op.name
    }

    if (op.op === 'delete_day') {
      // `findDay` нужен до фильтра: на опечатку в id лучше ошибка, чем «ничего не произошло».
      const day = findDay(next, op.dayId)
      next.days = next.days.filter((item) => item.id !== day.id)
    }
  }

  reindex(next)
  return next
}

/** «15 · 20 · 20 · 20 кг»; пусто — один вес на все подходы. */
export function weightsLabel(weights: number[] | null | undefined): string {
  return weights && weights.length > 0 ? `${weights.join(' · ')} кг` : ''
}

export type ProgramDiffLine = {
  kind: 'added' | 'removed' | 'changed' | 'moved'
  dayName: string
  text: string
}

/**
 * Человеческий дифф программ для экрана «Что изменится» и истории изменений.
 * `names` превращает exerciseId в название («Жим ногами»).
 */
export function diffPrograms(
  before: ProgramTree,
  after: ProgramTree,
  names: (exerciseId: string) => string = (exerciseId) => exerciseId,
): ProgramDiffLine[] {
  const lines: ProgramDiffLine[] = []
  const beforeDays = new Map(before.days.map((day) => [day.id, day]))

  for (const day of after.days) {
    const previousDay = beforeDays.get(day.id)

    if (!previousDay) {
      lines.push({ kind: 'added', dayName: day.name, text: `Добавлен день: ${day.name}` })
      continue
    }

    const previousItems = new Map(previousDay.exercises.map((item) => [item.id, item]))
    const currentIds = new Set(day.exercises.map((item) => item.id))

    for (const item of day.exercises) {
      const previous = previousItems.get(item.id)
      const name = names(item.exerciseId)

      if (!previous) {
        lines.push({
          kind: 'added',
          dayName: day.name,
          text: `Добавлено: ${name}, ${formatScheme(item.sets, item.repMin, item.repMax)}`,
        })
        continue
      }

      const beforeScheme = formatScheme(previous.sets, previous.repMin, previous.repMax)
      const afterScheme = formatScheme(item.sets, item.repMin, item.repMax)

      if (previous.exerciseId !== item.exerciseId) {
        lines.push({
          kind: 'changed',
          dayName: day.name,
          text: `${names(previous.exerciseId)} → ${name}, ${afterScheme}`,
        })
      } else if (beforeScheme !== afterScheme) {
        lines.push({
          kind: 'changed',
          dayName: day.name,
          text: `${name}: ${beforeScheme} → ${afterScheme}`,
        })
      } else if (weightsLabel(previous.setWeights) !== weightsLabel(item.setWeights)) {
        lines.push({
          kind: 'changed',
          dayName: day.name,
          text: `${name}: вес по подходам ${weightsLabel(item.setWeights) || 'один на все'}`,
        })
      } else if (previous.order !== item.order) {
        lines.push({ kind: 'moved', dayName: day.name, text: `${name}: переставлено` })
      }
    }

    for (const item of previousDay.exercises) {
      if (!currentIds.has(item.id)) {
        lines.push({ kind: 'removed', dayName: day.name, text: `Убрано: ${names(item.exerciseId)}` })
      }
    }
  }

  const afterDayIds = new Set(after.days.map((day) => day.id))
  for (const day of before.days) {
    if (!afterDayIds.has(day.id)) {
      lines.push({ kind: 'removed', dayName: day.name, text: `Убран день: ${day.name}` })
    }
  }

  return lines
}