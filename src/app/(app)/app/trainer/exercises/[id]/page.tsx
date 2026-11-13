import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { getExercise, listAlternatives, listExercises, listMachines } from '@/modules/catalog'
import { ExerciseEditor } from '@/components/trainer/exercise-editor'
import { PageHeader, TrainerPage } from '@/components/trainer/page'

// Кабинет зависит от сессии и прав.
export const instant = false

/** Прямая ссылка на упражнение: та же правка по вкладкам, что и в окне из дерева. */
export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()
  const { id } = await params

  const [exercise, machines, alternatives, published] = await Promise.all([
    getExercise(id, { includeDrafts: true }),
    listMachines(),
    listAlternatives(id),
    listExercises(),
  ])

  if (!exercise) notFound()

  return (
    <TrainerPage>
      <PageHeader
        back={{ href: '/trainer/exercises', label: 'Упражнения' }}
        eyebrow={exercise.status === 'published' ? 'Опубликовано' : 'Черновик'}
        title={exercise.name}
        description="Правь нужный раздел и сохраняй — мастер по шагам нужен только при создании"
      />

      <div className="w-full max-w-[860px]">
        <ExerciseEditor
          exercise={exercise}
          machines={machines.map((machine) => ({
            id: machine.id,
            name: machine.name,
            zone: machine.zone,
          }))}
          alternatives={{
            initial: alternatives.map((item) => ({
              id: item.id,
              name: item.name,
              machineName: item.machineName,
            })),
            catalog: published.map((item) => ({
              id: item.id,
              name: item.name,
              machineName: item.machineName,
              machineId: item.machineId,
              machineZone: item.machineZone,
            })),
          }}
        />
      </div>

    </TrainerPage>
  )
}
