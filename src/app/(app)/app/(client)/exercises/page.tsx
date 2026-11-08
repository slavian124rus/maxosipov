import { requireClientPage } from '@/components/app/require-client-page'
import { CatalogClient } from '@/components/exercise/catalog-client'
import { assertClientAccess } from '@/modules/access'
import { listExercises, listMachines } from '@/modules/catalog'

// Экран зависит от сессии, подписки и каталога.
export const instant = false

export default async function ExercisesPage() {
  const { user } = await requireClientPage('/exercises')
  await assertClientAccess(user.id)

  const [items, machines] = await Promise.all([listExercises(), listMachines()])

  return (
    <CatalogClient
      items={items}
      machines={machines.map((machine) => ({ id: machine.id, name: machine.name }))}
    />
  )
}

