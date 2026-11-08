import { requireUser } from '@/modules/auth'
import { listMachines } from '@/modules/catalog'
import { ExerciseForm } from '@/components/trainer/exercise-form'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function NewExercisePage() {
  await requireUser()
  const machines = await listMachines()

  return (
    <ExerciseForm
      machines={machines.map((machine) => ({ id: machine.id, name: machine.name }))}
    />
  )
}
