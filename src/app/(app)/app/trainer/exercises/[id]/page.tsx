import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { getExercise, listMachines } from '@/modules/catalog'
import { ExerciseForm } from '@/components/trainer/exercise-form'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()
  const { id } = await params

  const [exercise, machines] = await Promise.all([
    getExercise(id, { includeDrafts: true }),
    listMachines(),
  ])

  if (!exercise) notFound()

  return (
    <ExerciseForm
      machines={machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        zone: machine.zone,
      }))}
      initial={exercise}
    />
  )
}
