import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getExercise, listMachines } from '@/modules/catalog'
import { ExerciseForm } from '@/components/trainer/exercise-form'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params

  const [exercise, machines] = await Promise.all([
    getExercise(id, { includeDrafts: true }),
    listMachines(),
  ])

  if (!exercise) notFound()

  return (
    <ExerciseForm
      machines={machines.map((machine) => ({ id: machine.id, name: machine.name }))}
      initial={exercise}
    />
  )
}
