import type { ClientCard } from '@/modules/trainer'

function dateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** Вкладка «История»: тренировки клиента по датам (новые сверху). */
export function HistoryTab({ card }: { card: ClientCard }) {
  if (card.sessions.length === 0) {
    return <p className="text-[15px] text-text-secondary">Тренировок ещё не было</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {card.sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
        >
          <span className="text-[15px] text-text">{dateRu(session.startedAt)}</span>
          <span className="text-[13px] text-text-muted">
            {session.mode === 'guided' ? 'пошаговый' : 'свободный'}
            {session.finishedAt ? '' : ' · не завершена'}
          </span>
        </div>
      ))}
    </div>
  )
}