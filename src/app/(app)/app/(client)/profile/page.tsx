import { PushOptIn } from '@/components/app/push-opt-in'
import { requireClientPage } from '@/components/app/require-client-page'

// Экран зависит от сессии и подписки.
export const instant = false
import { getAccessForUser } from '@/modules/access'
import { formatPhone } from '@/modules/auth'
import { listVisibleNotes } from '@/modules/trainer'
import { env } from '@/shared/env'
import { setWorkoutModeAction } from '../actions'

/** Дата в формате «7 декабря» по Красноярску. */
function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function accessLabel(status: string, endsAt: Date | null, hasAccess: boolean): string {
  if (status === 'trial' && hasAccess && endsAt) return `Пробный период до ${formatDateRu(endsAt)}`
  if (status === 'active' && hasAccess && endsAt) return `Подписка до ${formatDateRu(endsAt)}`
  if (status === 'frozen') return 'Подписка заморожена'
  return 'Подписка закончилась'
}

export default async function ProfilePage() {
  const { user } = await requireClientPage('/profile')
  const access = await getAccessForUser(user.id)
  const notes = await listVisibleNotes(user.id)

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Профиль</h1>

      <div className="flex flex-col gap-1">
        <p className="text-[17px]">{user.name || 'Без имени'}</p>
        <p className="text-[15px] text-text-secondary">{user.phone ? formatPhone(user.phone) : user.email}</p>
        <p className="text-[15px] text-text-secondary">
          {accessLabel(access.status, access.endsAt, access.hasAccess)}
        </p>
      </div>

      {notes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <p className="text-[13px] text-text-muted">Заметки Максима</p>
          {notes.map((note) => (
            <p
              key={note.id}
              className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-text"
            >
              {note.text}
            </p>
          ))}
        </section>
      ) : null}

      <PushOptIn vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null} />

      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-text-muted">Режим тренировки</p>
        <form action={setWorkoutModeAction} className="flex gap-2">
          <input type="hidden" name="mode" value="free" />
          <button
            type="submit"
            className={`h-12 flex-1 rounded-control border text-[15px] ${
              user.workoutMode === 'free'
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Свободный
          </button>
        </form>
        <form action={setWorkoutModeAction} className="flex gap-2">
          <input type="hidden" name="mode" value="guided" />
          <button
            type="submit"
            className={`h-12 flex-1 rounded-control border text-[15px] ${
              user.workoutMode === 'guided'
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Пошаговый
          </button>
        </form>
      </div>

      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="h-12 w-full rounded-control border border-border bg-surface-1 text-[15px] text-text"
        >
          Выйти
        </button>
      </form>
    </main>
  )
}
