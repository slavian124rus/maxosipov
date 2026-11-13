import { notFound } from 'next/navigation'
import { SettingsPage } from '@/components/trainer/page'
import { WarmupsEditor } from '@/components/trainer/warmups-editor'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listWarmupTemplates } from '@/modules/training'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function WarmupsSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'catalog.edit')) notFound()

  const templates = await listWarmupTemplates(actor.gymId)

  return (
    <SettingsPage title="Разминки">
      <p className="text-[15px] text-text-secondary">
        Перед тренировкой клиент видит разминку под тип дня: ноги, верх или всё тело. Если у клиента
        болит какая-то зона, пункты на неё убираются сами. Держи разминку в пределах 5–7 минут.
      </p>
      <WarmupsEditor
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          focus: template.focus,
          items: template.items,
        }))}
      />
    </SettingsPage>
  )
}
