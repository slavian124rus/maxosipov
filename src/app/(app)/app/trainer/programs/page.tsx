import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listClients } from '@/modules/trainer'
import { listTemplateItems } from '@/modules/training'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import { TemplatesClient } from '@/components/trainer/templates/templates-client'

// Список шаблонов зависит от сессии и прав.
export const instant = false

export default async function TrainerProgramsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'clients.edit_programs')) notFound()

  const [templates, clients] = await Promise.all([
    listTemplateItems(),
    can(actor, 'clients.view')
      ? listClients(actor).then((items) => items.map((client) => ({ id: client.id, name: client.name })))
      : Promise.resolve([]),
  ])

  return (
    <TrainerPage>
      <PageHeader
        title="Программы"
        description="Шаблоны тренировок: собери один раз — и назначай клиентам"
      />

      <TemplatesClient templates={templates} clients={clients} />
    </TrainerPage>
  )
}
