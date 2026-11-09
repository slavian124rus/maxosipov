import type { ClientCard } from '@/modules/trainer'
import { resolveClientFlagAction } from '@/app/(app)/app/trainer/clients/actions'

const STATUS: Record<string, string> = {
  pending: 'ждёт решения',
  accepted: 'принято',
  rejected: 'отклонено',
  reverted: 'откатили',
}

function dateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Вкладка «МаксИИм» (DESIGN.md §8.9): жалобы с контекстом и предложения со статусами.
 * Полная переписка клиента тренеру не показывается (ARCHITECTURE.md §9.9).
 */
export function CoachTab({ card }: { card: ClientCard }) {
  if (!card.permissions.viewAiFlags) {
    return <p className="text-[15px] text-text-secondary">Сообщения МаксИИму тебе не видны</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Жалобы на боль</h2>

        {card.aiFlags.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Жалоб нет</p>
        ) : (
          card.aiFlags.map((flag) => (
            <div key={flag.id} className="flex flex-col gap-2 rounded-card border border-danger/40 bg-surface-1 px-3 py-3">
              <p className="text-[13px] text-text-muted">
                {dateRu(flag.createdAt)} · {flag.flagged === 'injury' ? 'травма' : 'боль'}
              </p>

              {flag.context.map((line, index) => (
                <p
                  key={index}
                  className={`text-[15px] ${
                    line.flagged ? 'font-semibold text-danger' : 'text-text-secondary'
                  }`}
                >
                  {line.role === 'user' ? 'Клиент: ' : 'МаксИИм: '}
                  {line.content}
                </p>
              ))}

              <form action={resolveClientFlagAction}>
                <input type="hidden" name="id" value={flag.id} />
                <input type="hidden" name="clientId" value={card.id} />
                <button type="submit" className="h-10 rounded-control bg-surface-2 px-3 text-[15px] text-text">
                  Разобрался
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Предложения МаксИИма</h2>

        {card.proposals.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Предложений не было</p>
        ) : (
          card.proposals.map((proposal) => (
            <div key={proposal.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-2">
              <p className="text-[13px] text-text-muted">
                {dateRu(proposal.createdAt)} · {proposal.kind === 'new_program' ? 'новая программа' : 'изменение'} ·{' '}
                {STATUS[proposal.status] ?? proposal.status}
              </p>
              {proposal.lines.map((line, index) => (
                <p key={index} className="text-[15px] text-text-secondary">
                  {line.text}
                </p>
              ))}
              {proposal.rationale ? (
                <p className="text-[13px] text-text-muted">{proposal.rationale}</p>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}