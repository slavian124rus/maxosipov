import type { ClientCard } from '@/modules/trainer'
import type { CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { ProgramEditor } from '@/components/trainer/program-editor/program-editor'
import { RevertButton } from '@/components/trainer/program-editor/revert-button'

const ACTOR: Record<string, string> = {
  trainer: 'Максим',
  client: 'Клиент',
  ai_proposal_accepted: 'МаксИИм',
}

/** Вкладка «Программа»: редактор и история изменений с откатом ИИ. */
export function ProgramTab({ card, catalog }: { card: ClientCard; catalog: CatalogItem[] }) {
  if (!card.program) {
    return <p className="text-[15px] text-text-secondary">Активной программы нет</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold">{card.program.name}</h2>

      {card.permissions.editProgram ? (
        <ProgramEditor program={card.program} catalog={catalog} clientId={card.id} />
      ) : (
        <div className="flex flex-col gap-1">
          {card.program.days.map((day) => (
            <div key={day.id} className="rounded-card border border-border bg-surface-1 px-3 py-2">
              <p className="text-[15px] text-text">{day.name}</p>
              <p className="text-[13px] text-text-muted">Упражнений: {day.exercises.length}</p>
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold">История изменений</h3>

        {card.programChanges.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Изменений ещё не было</p>
        ) : (
          card.programChanges.map((change) => (
            <div key={change.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-2">
              <p className="text-[13px] text-text-muted">
                {ACTOR[change.actorKind] ?? change.actorKind} ·{' '}
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
              {change.actorKind === 'ai_proposal_accepted' && card.permissions.editProgram ? (
                <RevertButton changeId={change.id} clientId={card.id} />
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}