import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listClients } from '@/modules/trainer'
import { listTemplates } from '@/modules/training'
import { createTemplateAction } from './actions'
import { AssignClientsForm } from './assign-form'

// Список шаблонов зависит от сессии и прав.
export const instant = false

export default async function TrainerProgramsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'clients.edit_programs')) notFound()

  const templates = await listTemplates()
  const clients = can(actor, 'clients.view')
    ? (await listClients(actor)).map((client) => ({ id: client.id, name: client.name }))
    : []

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Программы</h1>

      <form action={createTemplateAction} className="flex gap-2">
        <input
          name="name"
          placeholder="Название шаблона"
          aria-label="Название шаблона"
          className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
        />
        <button type="submit" className="h-12 rounded-control bg-surface-2 px-4 text-[15px] text-text">
          Создать
        </button>
      </form>

      {templates.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Шаблонов пока нет — создай первый</p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <div key={template.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3">
              <Link href={`/trainer/programs/${template.id}`} className="text-[17px] text-text">
                {template.name}
              </Link>
              <AssignClientsForm templateId={template.id} clients={clients} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}