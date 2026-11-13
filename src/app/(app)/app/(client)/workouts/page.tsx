import { requireClientPage } from '@/components/app/require-client-page'
import { listSessions } from '@/modules/training'

// Экран зависит от сессии.
export const instant = false

function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function WorkoutsPage() {
  const { user } = await requireClientPage('/workouts')
  const sessions = await listSessions(user.id)

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Тренировки</h1>

      <ul className="flex flex-col gap-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <a
              href={`/workouts/${session.id}`}
              className="flex items-baseline justify-between gap-2 rounded-card border border-border bg-surface-1 px-4 py-3"
            >
              <span className="text-[17px]">{formatDateRu(session.startedAt)}</span>
              <span className="text-[13px] text-text-muted">
                {session.mode === 'guided' ? 'пошаговый' : 'свободный'}
              </span>
            </a>
          </li>
        ))}
      </ul>

      {sessions.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Здесь появятся завершённые тренировки</p>
      ) : null}
    </main>
  )
}
