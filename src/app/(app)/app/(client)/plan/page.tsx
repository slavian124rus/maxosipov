import { redirect } from 'next/navigation'
import { MyPlan, type PlanChange } from '@/components/plan/my-plan'
import { requireClientPage } from '@/components/app/require-client-page'
import { assertClientAccess } from '@/modules/access'
import { listExercises } from '@/modules/catalog'
import { estimateDayMinutes, getActiveProgram, listProgramChanges } from '@/modules/training'

// Экран зависит от сессии, подписки и программы.
export const instant = false

const WHO = { client: 'Ты', trainer: 'Максим', ai_proposal_accepted: 'МаксИИм' } as const

/** «Мой план» (DESIGN.md §8.1): клиент сам правит подходы, отдых и состав программы. */
export default async function PlanPage() {
  const { user } = await requireClientPage('/plan')
  await assertClientAccess(user.id)

  const program = await getActiveProgram(user.id)
  if (!program) redirect('/')

  const [catalog, changes] = await Promise.all([
    listExercises({ status: 'published' }),
    listProgramChanges(program.id, 10),
  ])
  const names = new Map(catalog.map((item) => [item.id, item]))

  const history: PlanChange[] = changes.map((change) => ({
    id: change.id,
    who: WHO[change.actorKind],
    at: change.createdAt.toISOString(),
    lines: change.diff.map((line) => line.text),
  }))

  return (
    <MyPlan
      programId={program.id}
      programName={program.name}
      days={program.days.map((day) => ({
        id: day.id,
        name: day.name,
        minutes: estimateDayMinutes(day),
        exercises: day.exercises.map((item) => ({
          id: item.id,
          exerciseId: item.exerciseId,
          name: names.get(item.exerciseId)?.name ?? 'Упражнение',
          machineName: names.get(item.exerciseId)?.machineName ?? null,
          sets: item.sets,
          repMin: item.repMin,
          repMax: item.repMax,
          restSec: item.restSec,
        })),
      }))}
      catalog={catalog.map((item) => ({
        id: item.id,
        name: item.name,
        machineName: item.machineName,
        zone: item.machineZone,
        primary: item.primaryMuscles,
      }))}
      history={history}
    />
  )
}
