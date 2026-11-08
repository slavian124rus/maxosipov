import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listMachines } from '@/modules/catalog'
import { ExerciseForm } from '@/components/trainer/exercise-form'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function NewExercisePage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()
  const machines = await listMachines()

  return (
    <ExerciseForm
      machines={machines.map((machine) => ({ id: machine.id, name: machine.name }))}
    />
  )
}
