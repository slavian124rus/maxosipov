import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { getClientProfile } from '@/modules/auth'
import { exercises, machines } from '@/modules/catalog'
import {
  estimateProgramWeights,
  type StartWeightExercise,
  type StartWeightProfile,
} from '@/modules/progression'
import { db } from '@/shared/db'
import type { ProgramTree } from './patch'
import { nextWeights, programDays, programExercises, setLogs, workoutSessions } from './schema'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/** Что нужно знать об упражнении, чтобы посчитать стартовый вес. */
export type WeightHint = StartWeightExercise & {
  name: string
  machineName: string | null
  loadType: 'external' | 'bodyweight' | 'bodyweight_plus'
}

/**
 * Подсказки по упражнениям: основные мышцы, тренажёр и шаг веса.
 * Шаг берём у тренажёра; упражнение без тренажёра считаем свободными весами (2,5 кг).
 */
export async function loadWeightHints(
  exerciseIds: string[],
  executor: Executor = db,
): Promise<Map<string, WeightHint>> {
  const unique = [...new Set(exerciseIds)]
  if (unique.length === 0) return new Map()

  const rows = await executor
    .select({
      id: exercises.id,
      name: exercises.name,
      primary: exercises.primaryMuscles,
      machineId: exercises.machineId,
      machineName: machines.name,
      stepKg: machines.weightStepKg,
      loadType: exercises.loadType,
    })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .where(inArray(exercises.id, unique))

  return new Map(
    rows.map((row) => [
      row.id,
      {
        name: row.name,
        machineName: row.machineName,
        primary: row.primary,
        onMachine: row.machineId !== null,
        stepKg: row.stepKg ?? 2.5,
        loadType: row.loadType,
      },
    ]),
  )
}

/** Профиль в виде, который понимает расчёт весов. */
export function toStartWeightProfile(
  profile: Awaited<ReturnType<typeof getClientProfile>>,
): StartWeightProfile | null {
  if (!profile) return null

  return {
    sex: profile.sex,
    birthYear: profile.birthYear,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goal: profile.goal,
    experience: profile.experience,
    sessionsPerWeek: profile.sessionsPerWeek,
  }
}

/**
 * Веса по анкете: `exerciseId → кг`. Без анкеты — пустой объект: ничего не выдумываем,
 * тренер выставит веса сам или попросит МаксИИма.
 */
export async function estimateWeightsForClient(
  clientId: string,
  exerciseIds: string[],
  executor: Executor = db,
): Promise<Record<string, number>> {
  const profile = toStartWeightProfile(await getClientProfile(clientId))
  if (!profile) return {}

  const hints = await loadWeightHints(exerciseIds, executor)
  // «Только свой вес» — килограммы не считаем.
  const items = [...hints.entries()]
    .filter(([, hint]) => hint.loadType !== 'bodyweight')
    .map(([exerciseId, hint]) => ({ exerciseId, hint }))

  return estimateProgramWeights(items, profile)
}

/** Сколько упражнений программы уже с весом — для подписи на вкладке «Программа». */
export function programWeightStats(tree: ProgramTree): { total: number; withWeight: number } {
  const items = tree.days.flatMap((day) => day.exercises)

  return {
    total: items.length,
    withWeight: items.filter((item) => (item.targetWeightKg ?? 0) > 0).length,
  }
}

/**
 * Проставляет веса упражнениям программы. `onlyEmpty` — не трогаем то, что тренер уже задал.
 * Возвращает число обновлённых строк.
 */
export async function applyProgramWeights(
  programId: string,
  weights: Record<string, number>,
  options: { onlyEmpty?: boolean } = {},
  executor: Executor = db,
): Promise<number> {
  const rows = await executor
    .select({
      id: programExercises.id,
      exerciseId: programExercises.exerciseId,
      targetWeightKg: programExercises.targetWeightKg,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.dayId))
    .where(eq(programDays.programId, programId))

  let updated = 0

  for (const row of rows) {
    const weight = weights[row.exerciseId]
    if (weight === undefined || !Number.isFinite(weight) || weight < 0) continue
    if (options.onlyEmpty && (row.targetWeightKg ?? 0) > 0) continue
    if (row.targetWeightKg === weight) continue

    await executor
      .update(programExercises)
      .set({ targetWeightKg: weight })
      .where(eq(programExercises.id, row.id))

    updated += 1
  }

  return updated
}

/** Заполняет пустые веса программы по анкете владельца (шаблоны не трогаем). */
export async function fillProgramWeightsFromProfile(
  tree: ProgramTree,
  executor: Executor = db,
): Promise<{ filled: number; total: number; hasProfile: boolean }> {
  const total = tree.days.reduce((sum, day) => sum + day.exercises.length, 0)
  if (tree.ownerId === null || total === 0) return { filled: 0, total, hasProfile: false }

  const exerciseIds = tree.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))
  const weights = await estimateWeightsForClient(tree.ownerId, exerciseIds, executor)

  if (Object.keys(weights).length === 0) return { filled: 0, total, hasProfile: false }

  const filled = await applyProgramWeights(tree.id, weights, { onlyEmpty: true }, executor)
  return { filled, total, hasProfile: true }
}

export type ProgramExerciseHint = {
  programExerciseId: string
  exerciseId: string
  name: string
  machineName: string | null
  primary: string[]
  stepKg: number
  sets: number
  repMin: number
  repMax: number
  currentWeightKg: number | null
}

/** Упражнения программы с данными для предпросмотра весов (тренер и МаксИИм). */
export async function programExerciseHints(
  tree: ProgramTree,
  executor: Executor = db,
): Promise<ProgramExerciseHint[]> {
  const hints = await loadWeightHints(
    tree.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    executor,
  )

  return tree.days.flatMap((day) =>
    day.exercises.map((item) => {
      const hint = hints.get(item.exerciseId)

      return {
        programExerciseId: item.id,
        exerciseId: item.exerciseId,
        name: hint?.name ?? 'Упражнение',
        machineName: hint?.machineName ?? null,
        primary: [...(hint?.primary ?? [])],
        stepKg: hint?.stepKg ?? 2.5,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        currentWeightKg: item.targetWeightKg,
      }
    }),
  )
}


/**
 * Последний рабочий вес клиента по каждому упражнению: максимум по самой свежей завершённой
 * тренировке, где упражнение было. Нулевой вес (свой вес тела) не считается.
 */
export async function lastWorkingWeights(
  userId: string,
  exerciseIds: string[],
  executor: Executor = db,
): Promise<Record<string, number>> {
  const unique = [...new Set(exerciseIds)]
  if (unique.length === 0) return {}

  const rows = await executor
    .select({
      exerciseId: setLogs.exerciseId,
      sessionId: setLogs.sessionId,
      weightKg: setLogs.weightKg,
      startedAt: workoutSessions.startedAt,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(workoutSessions.id, setLogs.sessionId))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.finishedAt),
        inArray(setLogs.exerciseId, unique),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt))

  const result: Record<string, number> = {}
  const latestSession = new Map<string, string>()

  for (const row of rows) {
    const owner = latestSession.get(row.exerciseId)
    if (owner === undefined) latestSession.set(row.exerciseId, row.sessionId)
    else if (owner !== row.sessionId) continue

    if (row.weightKg > (result[row.exerciseId] ?? 0)) result[row.exerciseId] = row.weightKg
  }

  return result
}

/**
 * Единая точка подбора планового веса. Пустые веса программы заполняются по приоритету:
 * 1) принятый «вес на следующий раз»; 2) последний рабочий вес из истории; 3) оценка по анкете.
 * Уже заданные веса не трогаем; упражнения «только свой вес» пропускаем.
 * `carry` — веса прежней программы (при выдаче новой): они важнее истории.
 */
export async function resolvePlanWeights(
  programId: string,
  userId: string,
  options: { carry?: Record<string, number> } = {},
  executor: Executor = db,
): Promise<number> {
  const rows = await executor
    .select({
      exerciseId: programExercises.exerciseId,
      targetWeightKg: programExercises.targetWeightKg,
      loadType: exercises.loadType,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.dayId))
    .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
    .where(eq(programDays.programId, programId))

  const needed = [
    ...new Set(
      rows
        .filter((row) => row.loadType !== 'bodyweight' && (row.targetWeightKg ?? 0) <= 0)
        .map((row) => row.exerciseId),
    ),
  ]
  if (needed.length === 0) return 0

  const saved = await executor
    .select({ exerciseId: nextWeights.exerciseId, weightKg: nextWeights.weightKg })
    .from(nextWeights)
    .where(and(eq(nextWeights.userId, userId), inArray(nextWeights.exerciseId, needed)))

  const resolved: Record<string, number> = {}
  const take = (source: Record<string, number>): void => {
    for (const id of needed) {
      const weight = source[id]
      if (resolved[id] === undefined && weight !== undefined && weight > 0) resolved[id] = weight
    }
  }

  take(options.carry ?? {})
  take(Object.fromEntries(saved.map((row) => [row.exerciseId, row.weightKg])))
  take(await lastWorkingWeights(userId, needed, executor))

  const rest = needed.filter((id) => resolved[id] === undefined)
  if (rest.length > 0) take(await estimateWeightsForClient(userId, rest, executor))

  return applyProgramWeights(programId, resolved, { onlyEmpty: true }, executor)
}
