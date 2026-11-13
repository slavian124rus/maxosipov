import Link from 'next/link'
import { PushOptIn } from '@/components/app/push-opt-in'
import { requireClientPage } from '@/components/app/require-client-page'
import { TodayWorkoutCard } from '@/components/workout/today-workout-card'
import { getAccessForUser } from '@/modules/access'
import { getGym } from '@/modules/gym'
import {
  getActiveProgram,
  getLastFinishedDayId,
  getOngoingSession,
  getWeekWorkoutDays,
  listSessions,
  listTemplates,
  pickWorkoutDay,
  estimateDayMinutes,
} from '@/modules/training'
import { adminUrl } from '@/shared/app-url'
import { env } from '@/shared/env'
import { copyTemplateAction } from './actions'

// Экран зависит от сессии, программы и подписки.
export const instant = false

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Я'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function TodayPage() {
  const { user } = await requireClientPage('/')
  const isStaff = (await getAccessForUser(user.id)).bypass

  const gym = await getGym()

  const [program, access, streak, lastDayId, ongoing, templates, sessions] = await Promise.all([
    getActiveProgram(user.id),
    getAccessForUser(user.id),
    getWeekWorkoutDays(user.id, new Date(), gym.timezone),
    getLastFinishedDayId(user.id),
    getOngoingSession(user.id),
    listTemplates(),
    listSessions(user.id, 1),
  ])

  const days = program?.days ?? []
  const nextDay = pickWorkoutDay(days, lastDayId)

  return (
    <main className="flex flex-col gap-5 px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] lg:items-start lg:gap-8 lg:px-0 lg:py-0">
      <header className="flex items-center justify-between lg:col-span-2">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-muted">Сегодня</p>
          <h1 className="text-[22px] font-semibold">Привет, {user.name || 'друг'}</h1>
        </div>
        <Link
          href="/profile"
          aria-label="Профиль"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-[15px] text-text-secondary"
        >
          {initials(user.name)}
        </Link>
      </header>

      {isStaff ? (
        <a
          href={adminUrl('/').toString()}
          className="flex h-12 items-center justify-center rounded-control border border-border bg-surface-1 text-[15px] lg:col-span-2 lg:w-fit lg:px-5"
        >
          Открыть кабинет
        </a>
      ) : null}

      <div className="flex flex-col gap-5">
        {nextDay ? (
          <TodayWorkoutCard
            days={days.map((day) => ({
              id: day.id,
              name: day.name,
              exercises: day.exercises.length,
              minutes: estimateDayMinutes(day),
            }))}
            recommendedId={pickWorkoutDay(days, lastDayId)?.id ?? nextDay.id}
            ongoingDayId={ongoing?.dayId ?? null}
          />
        ) : (
          <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
            <p className="text-[15px] text-text-secondary">Максим скоро подберёт тебе программу</p>
            {templates.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-text-muted">Или выбери шаблон сам</p>
                {templates.map((template) => (
                  <form key={template.id} action={copyTemplateAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <button
                      type="submit"
                      className="min-h-12 w-full rounded-control border border-border bg-surface-2 px-4 text-left text-[15px]"
                    >
                      {template.name}
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <p className="text-[13px] text-text-muted">Серия за неделю</p>
          <div className="flex justify-between">
            {WEEKDAYS.map((label, index) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span
                  className={`h-3 w-3 rounded-full ${streak[index] ? 'bg-accent' : 'bg-surface-2'}`}
                />
                <span className="text-[11px] text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        {access.hasAccess && (access.daysLeft ?? 99) <= 7 ? (
          <p className="text-[15px] text-warning">
            {access.status === 'trial' ? 'Пробный период' : 'Подписка'}: осталось {access.daysLeft}{' '}
            дн.
          </p>
        ) : null}

        {sessions.some((session) => session.finishedAt) ? (
          <PushOptIn vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null} />
        ) : null}
      </aside>
    </main>
  )
}
