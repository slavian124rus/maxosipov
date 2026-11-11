import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listExercises, listMachinesWithPhotos } from '@/modules/catalog'
import { MachinesClient } from '@/components/trainer/machines-client'
import { TrainerPage } from '@/components/trainer/page'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function TrainerMachinesPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()

  const [machines, exercises] = await Promise.all([
    listMachinesWithPhotos(),
    listExercises({ status: 'published' }),
  ])

  // Сколько опубликованных упражнений на каждом тренажёре.
  const counts: Record<string, number> = {}
  for (const exercise of exercises) {
    if (!exercise.machineId) continue
    counts[exercise.machineId] = (counts[exercise.machineId] ?? 0) + 1
  }

  return (
    <TrainerPage>
      <MachinesClient machines={machines} counts={counts} />
    </TrainerPage>
  )
}


