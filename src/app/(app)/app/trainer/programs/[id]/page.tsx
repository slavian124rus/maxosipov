import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import { can } from '@/modules/rbac'
import { getClientCard } from '@/modules/trainer'
import { getProgramTree, listProgramChanges } from '@/modules/training'
import { ProgramEditor, type CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { RevertButton } from '@/components/trainer/program-editor/revert-button'
import { isNotFoundError } from '@/shared/errors'

// Экран зависит от сессии и прав.
export const instant = false

const ACTOR_LABELS: Record<string, string> = {
  trainer: 'Максим',
  client: 'Клиент',
  ai_proposal_accepted: 'МаксИИм (принято клиентом)',
}

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireUser()
  const { id } = await params

  const program = await getProgramTree(id)
  if (!program) notFound()

  const clientId = program.ownerId

  if (clientId === null) {
    if (!can(actor, 'clients.edit_programs')) notFound()
  } else {
    try {
      const card = await getClientCard(actor, clientId)
      if (!card.permissions.editProgram) notFound()
    } catch (error) {
      if (isNotFoundError(error)) notFound()
      throw error
    }
  }

  const catalog: CatalogItem[] = (await listExercises({ status: 'published' })).map((item) => ({
    id: item.id,
    name: item.name,
    machineName: item.machineName,
    primary: item.primaryMuscles,
  }))

  const changes = await listProgramChanges(program.id, 15)

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[13px] text-text-muted">{clientId === null ? 'Шаблон' : 'Программа клиента'}</p>
        <h1 className="text-[22px] font-semibold">{program.name}</h1>
      </header>

      <ProgramEditor program={program} catalog={catalog} clientId={clientId} />

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">История изменений</h2>

        {changes.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Изменений ещё не было</p>
        ) : (
          changes.map((change) => (
            <div key={change.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-2">
              <p className="text-[13px] text-text-muted">
                {ACTOR_LABELS[change.actorKind] ?? change.actorKind} ·{' '}
                {new Intl.DateTimeFormat('ru-RU', {
                  timeZone: 'Asia/Krasnoyarsk',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(change.createdAt)}
              </p>
              {change.diff.slice(0, 4).map((line, index) => (
                <p key={index} className="text-[15px] text-text-secondary">
                  {line.text}
                </p>
              ))}
              {change.actorKind === 'ai_proposal_accepted' ? (
                <RevertButton changeId={change.id} clientId={clientId} />
              ) : null}
            </div>
          ))
        )}
      </section>
    </main>
  )
}