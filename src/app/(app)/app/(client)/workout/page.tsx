import { redirect } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { buildWorkoutExercise } from './build-exercise'
import { WorkoutClient } from '@/components/workout/workout-client'
import { assertClientAccess } from '@/modules/access'
import { listAlternatives, listExercises } from '@/modules/catalog'
import { loadPainState } from '@/modules/coach-ai'
import { getGym } from '@/modules/gym'
import {
  getActiveProgram,
  adjustWarmupForPain,
  getLastFinishedDayId,
  listWarmupTemplates,
  resolveDayFocus,
  warmupSeconds,
  getOngoingSession,
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
  const [lastDayId, ongoing] = await Promise.all([
    getLastFinishedDayId(user.id),
    getOngoingSession(user.id),
  ])
  // День мог быть выбран клиентом на экране «Сегодня» или уже начат — тогда продолжаем его.
  const day =
    pickWorkoutDay(program.days, lastDayId, requestedDayId ?? ongoing?.dayId ?? null) ??
    program.days[0]!

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
    setWeights: item.setWeights,
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
      setWeights: null,
    })
  }

  const exercises = await Promise.all(
    baseEntries.map((entry) =>
      buildWorkoutExercise(user.id, entry, recommendations[entry.exerciseId] ?? null),
    ),
  )

  // «Занято? Заменить»: список запасных упражнений по карточкам дня.
  const alternativeLists = await Promise.all(
    exercises.map((item) => listAlternatives(item.exerciseId)),
  )
  const alternatives = Object.fromEntries(
    exercises.map((item, index) => [
      item.programExerciseId,
      alternativeLists[index]!.map((alt) => ({
        id: alt.id,
        name: alt.name,
        machineName: alt.machineName,
      })),
    ]),
  )

  // Разминка под тип дня; при открытой жалобе на боль пункты на больную зону заменяем кодом.
  const [catalog, templates, pain] = await Promise.all([
    listExercises(),
    listWarmupTemplates(gym.id),
    loadPainState(user.id),
  ])
  const primaryById = new Map(catalog.map((item) => [item.id, item.primaryMuscles as string[]]))
  const focus = resolveDayFocus(
    null,
    day.exercises.map((item) => primaryById.get(item.exerciseId) ?? []),
  )
  const chosen = templates.find((item) => item.focus === focus) ??
    templates.find((item) => item.focus === 'full') ??
    templates[0]
  const warmupItems = chosen
    ? adjustWarmupForPain(
        chosen.items,
        pain.zones,
        templates.flatMap((item) => item.items),
      )
    : []
  const warmup = chosen && warmupItems.length > 0
    ? {
        name: chosen.name,
        minutes: Math.max(1, Math.round(warmupSeconds(warmupItems) / 60)),
        items: warmupItems.map((item) => ({
          title: item.title,
          durationSec: item.durationSec,
          reps: item.reps,
          note: item.note,
        })),
      }
    : null

  return (
    <WorkoutClient
      programId={program.id}
      programDayId={day.id}
      dayName={day.name}
      mode={user.workoutMode === 'guided' ? 'guided' : 'free'}
      exercises={exercises}
      alternatives={alternatives}
      warmup={warmup}
      rules={gym.settings.progressionRules}
    />
  )
}