import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { countMachineExercises, listMachinesWithPhotos } from '@/modules/catalog'
import { MachinesClient } from '@/components/trainer/machines-client'
import { TrainerPage } from '@/components/trainer/page'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function TrainerMachinesPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()

  const [machines, counts] = await Promise.all([
    listMachinesWithPhotos(),
    countMachineExercises(),
  ])

  // `published` — подпись «N в каталоге», `total` (с черновиками) — можно ли удалить.
  const published: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (const [machineId, count] of Object.entries(counts)) {
    published[machineId] = count.published
    total[machineId] = count.total
  }

  return (
    <TrainerPage>
      <MachinesClient machines={machines} counts={published} exerciseTotals={total} />
    </TrainerPage>
  )
}


