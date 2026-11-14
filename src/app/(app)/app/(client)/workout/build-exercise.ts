import { getExercise } from '@/modules/catalog'
import { getHistoryForExercise, getNextWeight, lastWorkingWeights } from '@/modules/training'
import { alignSetWeights } from '@/shared/set-weights'
import type { WorkoutExercise } from '@/components/workout/free-mode'

export type WorkoutEntry = {
  programExerciseId: string
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  targetWeightKg: number | null
  /** Вес по подходам из программы; `null` — один вес на все. */
  setWeights?: number[] | null
}

type Recommendation = { action: string; weightKg: number | null; text: string }

/**
 * Карточка упражнения для экрана тренировки: каталог, история и стартовый вес.
 * Порядок стартового веса: «на следующий раз» → рекомендация → вес из программы → прошлый рабочий.
 */
export async function buildWorkoutExercise(
  userId: string,
  entry: WorkoutEntry,
  recommendation: Recommendation | null = null,
): Promise<WorkoutExercise> {
  // Упражнение уже в программе клиента: даже если карточку вернули в черновики, тренировка не должна опустеть.
  const detail = await getExercise(entry.exerciseId, { includeDrafts: true })
  const [nextWeight, history, lastWeights] = await Promise.all([
    getNextWeight(userId, entry.exerciseId),
    // История завершённых тренировок: по ней и по текущим подходам экран считает «В следующий раз»
    getHistoryForExercise(userId, entry.exerciseId, 6, { finishedOnly: true }),
    lastWorkingWeights(userId, [entry.exerciseId]),
  ])
  const bodyweight = detail?.loadType === 'bodyweight'
  const startWeightKg = bodyweight
    ? 0
    : (nextWeight ??
      recommendation?.weightKg ??
      entry.targetWeightKg ??
      lastWeights[entry.exerciseId] ??
      0)

  return {
    programExerciseId: entry.programExerciseId,
    exerciseId: entry.exerciseId,
    name: detail?.name ?? 'Упражнение',
    machineName: detail?.machineName ?? null,
    slug: detail?.slug ?? '',
    steps: detail?.steps ?? [],
    mistakes: detail?.mistakes ?? [],
    tips: detail?.tips ?? null,
    sets: entry.sets,
    repMin: entry.repMin,
    repMax: entry.repMax,
    restSec: entry.restSec,
    loadType: detail?.loadType ?? 'external',
    stepKg: detail?.weightStepKg ?? 2.5,
    // Пока видео нет, в тренировке показываем фото тренажёра вместо пустого превью.
    posterUrl: detail?.posterUrl ?? detail?.photoUrl ?? null,
    videoMp4Url: detail?.videoMp4Url ?? null,
    videoWebmUrl: detail?.videoWebmUrl ?? null,
    recommendation: recommendation && !bodyweight ? recommendation : null,
    startWeightKg,
    // Рисунок «15/20/20/20» сохраняется, а рабочий вес ведёт прогрессия: план сдвигается к стартовому весу.
    planSetWeights: bodyweight ? null : alignSetWeights(entry.setWeights, startWeightKg),
    planWeightKg: bodyweight ? null : (entry.targetWeightKg ?? null),
    history: history.map((session) => ({ date: session.date.toISOString(), sets: session.sets })),
  }
}
