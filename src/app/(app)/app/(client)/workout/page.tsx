import { redirect } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { WorkoutClient } from '@/components/workout/workout-client'
import { assertClientAccess } from '@/modules/access'
import { getExercise } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import {
  getActiveProgram,
  getHistoryForExercise,
  getLastFinishedDayId,
  getNextWeight,
  getRecommendations,
  pickWorkoutDay,
} from '@/modules/training'

// Экран зависит от сессии, подписки и программы.
export const instant = false

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; day?: string }>
}) {
  const { user } = await requireClientPage('/workout')
  await assertClientAccess(user.id)

  const program = await getActiveProgram(user.id)
  if (!program || program.days.length === 0) redirect('/')

  const { exercise: extraExerciseId, day: requestedDayId } = await searchParams
  const lastDayId = await getLastFinishedDayId(user.id)
  // День мог быть выбран клиентом на экране «Сегодня» — тогда берём его.
  const day = pickWorkoutDay(program.days, lastDayId, requestedDayId ?? null) ?? program.days[0]!

  const recommendations = await getRecommendations(user.id, day.id)
  const gym = await getGym()

  const baseEntries = day.exercises.map((item) => ({
    programExerciseId: item.id,
    exerciseId: item.exerciseId,
    sets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    restSec: item.restSec,
    // Вес из программы клиента: его подставили по анкете при выдаче шаблона.
    targetWeightKg: item.targetWeightKg,
  }))

  // «В тренировку» с карточки упражнения: добавляем его в конец дня, если его там нет.
  if (extraExerciseId && !baseEntries.some((item) => item.exerciseId === extraExerciseId)) {
    baseEntries.push({
      programExerciseId: `extra-${extraExerciseId}`,
      exerciseId: extraExerciseId,
      sets: 3,
      repMin: 10,
      repMax: 12,
      restSec: 90,
      targetWeightKg: null,
    })
  }

  const exercises = await Promise.all(
    baseEntries.map(async (entry) => {
      const detail = await getExercise(entry.exerciseId)
      const nextWeight = await getNextWeight(user.id, entry.exerciseId)
      const recommendation = recommendations[entry.exerciseId]
      // История завершённых тренировок: по ней и по текущим подходам экран считает «В следующий раз»
      const history = await getHistoryForExercise(user.id, entry.exerciseId, 6, { finishedOnly: true })

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
        stepKg: detail?.weightStepKg ?? 2.5,
        // Пока видео нет, в тренировке показываем фото тренажёра вместо пустого превью.
        posterUrl: detail?.posterUrl ?? detail?.photoUrl ?? null,
        videoMp4Url: detail?.videoMp4Url ?? null,
        videoWebmUrl: detail?.videoWebmUrl ?? null,
        recommendation: recommendation
          ? {
              action: recommendation.action,
              weightKg: recommendation.weightKg,
              text: recommendation.text,
            }
          : null,
        // Порядок важен: «на следующий раз» → рекомендация по истории → вес из программы.
        // Последний — план тренера из анкеты: без него на первом подходе был бы 0 кг.
        startWeightKg: nextWeight ?? recommendation?.weightKg ?? entry.targetWeightKg ?? 0,
        planWeightKg: entry.targetWeightKg ?? null,
        history: history.map((session) => ({ date: session.date.toISOString(), sets: session.sets })),
      }
    }),
  )

  return (
    <WorkoutClient
      programId={program.id}
      programDayId={day.id}
      dayName={day.name}
      mode={user.workoutMode === 'guided' ? 'guided' : 'free'}
      exercises={exercises}
      rules={gym.settings.progressionRules}
    />
  )
}