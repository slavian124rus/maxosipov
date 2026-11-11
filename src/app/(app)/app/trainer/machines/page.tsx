import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listExercises, listMachines } from '@/modules/catalog'
import { MachineForm } from '@/components/trainer/machine-form'
import { MachineTree } from '@/components/trainer/machine-tree'
import type { MachineTreeItem } from '@/components/trainer/catalog-tree'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function TrainerMachinesPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()

  const [machines, exercises] = await Promise.all([
    listMachines(),
    listExercises({ status: 'published' }),
  ])

  // Сколько опубликованных упражнений на каждом тренажёре.
  const counts = new Map<string, number>()
  for (const exercise of exercises) {
    if (!exercise.machineId) continue
    counts.set(exercise.machineId, (counts.get(exercise.machineId) ?? 0) + 1)
  }

  const items: MachineTreeItem[] = machines.map((machine) => ({
    id: machine.id,
    name: machine.name,
    zone: machine.zone,
    weightStepKg: machine.weightStepKg,
    exerciseCount: counts.get(machine.id) ?? 0,
  }))

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Тренажёры</h1>

      <MachineTree machines={items} />

      <MachineForm />
    </main>
  )
}

