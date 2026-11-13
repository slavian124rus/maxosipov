import { notFound } from 'next/navigation'
import { ClientBackLink } from '@/components/app/back-link'
import { requireClientPage } from '@/components/app/require-client-page'
import { getGym } from '@/modules/gym'
import { formatWeight } from '@/modules/progression'
import { getSessionDetail, getSessionSummary } from '@/modules/training'
import { formatLongDate, minutesBetween } from '@/shared/dates'

// Экран зависит от сессии.
export const instant = false

const FEELINGS: Record<string, string> = {
  easy: 'Легко',
  good: 'Отлично',
  hard: 'Тяжело',
}

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user } = await requireClientPage('/workouts')
  const { sessionId } = await params
  const gym = await getGym()

  const [detail, summary] = await Promise.all([
    getSessionDetail(user.id, sessionId),
    getSessionSummary(user.id, sessionId),
  ])

  if (!detail) notFound()

  const durationMin = detail.finishedAt ? minutesBetween(detail.startedAt, detail.finishedAt) : null

  return (
    <main className="flex flex-col gap-4 px-4 py-6 lg:mx-auto lg:w-full lg:max-w-[900px] lg:px-0 lg:py-0">
      <ClientBackLink href="/workouts" label="К тренировкам" />

      <h1 className="text-[22px] font-semibold">
        {formatLongDate(detail.startedAt, gym.timezone)}
      </h1>

      <p className="text-[15px] text-text-secondary">
        {durationMin !== null ? `${durationMin} мин · ` : ''}
        {formatWeight(summary?.volumeKg ?? 0)} · упражнений: {detail.exercises.length}
      </p>

      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-3">
        {detail.exercises.map((exercise) => (
          <li
            key={exercise.exerciseId}
            className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-3"
          >
            <span className="text-[17px]">{exercise.name}</span>

            <div className="flex flex-col gap-1">
              {exercise.sets.map((set) => (
                <span key={set.setIndex} className="text-[15px] text-text-secondary">
                  {set.setIndex}: {formatWeight(set.weightKg)} · {set.reps} раз
                  {set.feeling ? ` · ${FEELINGS[set.feeling] ?? set.feeling}` : ''}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
