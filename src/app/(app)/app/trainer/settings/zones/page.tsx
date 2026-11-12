import { notFound } from 'next/navigation'
import { listZones } from '@/modules/catalog'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { SettingsPage } from '@/components/trainer/page'
import { ZonesManager } from '@/components/trainer/zones-manager'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function ZonesSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()

  const zones = await listZones()

  return (
    <SettingsPage
      title="Зоны тренажёров"
      description="Кардио, ноги, спина… По зонам строится дерево в «Упражнениях» и «Тренажёрах»"
    >
      <ZonesManager zones={zones.map((zone) => ({ id: zone.id, name: zone.name, machineCount: zone.machineCount }))} />
    </SettingsPage>
  )
}
