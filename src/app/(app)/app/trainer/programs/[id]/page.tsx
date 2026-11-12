import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import { getProgramTree, listProgramChanges, templateTitle } from '@/modules/training'
import { ProgramEditor, type CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { RevertButton } from '@/components/trainer/program-editor/revert-button'
import { TemplateAssistant } from '@/components/trainer/templates/template-assistant'
import { DeleteTemplateButton } from '@/components/trainer/templates/delete-template-button'
import { TemplateMetaEditor } from '@/components/trainer/templates/template-meta-editor'
import { TemplateCreatedNotice } from '@/components/trainer/templates/template-created-notice'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import { assertProgramAccess } from '../access'

// Экран зависит от сессии и прав.
export const instant = false

const ACTOR_LABELS: Record<string, string> = {
  trainer: 'Максим',
  client: 'Клиент',
  ai_proposal_accepted: 'МаксИИм (принято клиентом)',
}

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { actor } = await requireUser()
  const { id } = await params
  const { created } = await searchParams

  const program = await getProgramTree(id)
  if (!program) notFound()

  await assertProgramAccess(actor, program)

  const clientId = program.ownerId

  const catalog: CatalogItem[] = (await listExercises({ status: 'published' })).map((item) => ({
    id: item.id,
    name: item.name,
    machineName: item.machineName,
    zone: item.machineZone,
    primary: item.primaryMuscles,
  }))

  const changes = await listProgramChanges(program.id, 15)
  const isTemplate = clientId === null
  const title = isTemplate
    ? templateTitle({
        name: program.name,
        audience: program.audience ?? null,
        number: program.templateNumber ?? null,
      })
    : program.name

  return (
    <TrainerPage>
      <PageHeader
        back={{
          href:
            clientId === null ? '/trainer/programs' : `/trainer/clients/${clientId}?tab=program`,
          label: clientId === null ? 'Программы' : 'К клиенту',
        }}
        eyebrow={clientId === null ? 'Шаблон' : 'Программа клиента'}
        title={title}
        actions={
          isTemplate ? (
            <>
              <TemplateMetaEditor
                templateId={program.id}
                name={program.name}
                audience={program.audience ?? null}
                goal={program.goal ?? null}
                number={program.templateNumber ?? null}
              />
              <DeleteTemplateButton templateId={program.id} title={title} />
            </>
          ) : null
        }
      />

      {created === '1' && isTemplate ? <TemplateCreatedNotice /> : null}

      {isTemplate ? (
        <TemplateAssistant
          templateId={program.id}
          templateTitle={title}
          catalog={catalog.map((item) => ({ id: item.id, name: item.name }))}
          defaultGoal={program.goal ?? null}
          defaultAudience={program.audience ?? null}
          hasDays={program.days.length > 0}
        />
      ) : null}

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
    </TrainerPage>
  )
}