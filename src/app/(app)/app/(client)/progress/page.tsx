import Link from 'next/link'
import { BarChart } from '@/components/charts/bar-chart'
import { LineChart } from '@/components/charts/line-chart'
import { requireClientPage } from '@/components/app/require-client-page'
import { getAccessForUser } from '@/modules/access'
import { listMeasurements, listProgressPhotos } from '@/modules/body'
import { getGym } from '@/modules/gym'
import { formatWeight } from '@/modules/progression'
import { getExerciseProgress, getTrainedExercises, getWeeklyVolume } from '@/modules/training'
import { formatLongDate, formatShortDate } from '@/shared/dates'

// Экран зависит от сессии и подписки (без подписки — только чтение).
export const instant = false

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>
}) {
  const { user, actor } = await requireClientPage('/progress')
  const gym = await getGym()
  const access = await getAccessForUser(user.id)

  const [trained, volume, measurements, photos] = await Promise.all([
    getTrainedExercises(user.id),
    getWeeklyVolume(user.id, 8, gym.timezone),
    listMeasurements(actor, user.id, { limit: 60 }),
    listProgressPhotos(actor, user.id),
  ])

  const { exercise: requested } = await searchParams
  const selectedId = requested ?? trained[0]?.exerciseId ?? null
  const progress = selectedId ? await getExerciseProgress(user.id, selectedId) : []

  const weights = measurements
    .filter((row) => row.weightKg !== null)
    .map((row) => ({ x: new Date(`${row.date}T00:00:00Z`), y: Number(row.weightKg) }))
    .reverse()

  const lastMeasurement = measurements.find((row) => row.weightKg !== null)

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Прогресс</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Рабочий вес</h2>

        {trained.length === 0 ? (
          <p className="text-[15px] text-text-secondary">
            Пока нет тренировок. Запиши первую — и здесь появится график
          </p>
        ) : (
          <>
            <div className="flex gap-2 scroll-row pb-1">
              {trained.map((item) => (
                <Link
                  key={item.exerciseId}
                  href={`/progress?exercise=${item.exerciseId}`}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                    item.exerciseId === selectedId
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <LineChart
              points={progress.map((point) => ({ x: point.date, y: point.workingWeightKg }))}
              timezone={gym.timezone}
              ariaLabel="Рабочий вес по тренировкам"
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Объём за неделю</h2>
        <BarChart
          bars={volume.map((week) => ({
            label: formatShortDate(new Date(`${week.weekStart}T00:00:00Z`), gym.timezone),
            value: week.volumeKg,
          }))}
          ariaLabel="Объём по неделям"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Замеры</h2>
          <Link href="/progress/measurements" className="text-[15px] text-accent">
            Все замеры
          </Link>
        </div>

        {weights.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Замеров пока нет</p>
        ) : (
          <>
            <LineChart points={weights} timezone={gym.timezone} ariaLabel="Вес тела по замерам" />
            {lastMeasurement ? (
              <p className="text-[15px] text-text-secondary">
                {formatWeight(Number(lastMeasurement.weightKg))} ·{' '}
                {formatLongDate(new Date(`${lastMeasurement.date}T00:00:00Z`), gym.timezone)}
              </p>
            ) : null}
          </>
        )}

        {access.hasAccess ? (
          <Link
            href="/progress/measurements"
            className="flex h-12 items-center justify-center rounded-control border border-border text-[15px] text-text"
          >
            Добавить замер
          </Link>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Фото</h2>
          <Link href="/progress/photos" className="text-[15px] text-accent">
            Фото и сравнение
          </Link>
        </div>

        {photos.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Фото пока нет</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 6).map((photo) =>
              photo.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка
                <img
                  key={photo.id}
                  src={photo.thumbUrl}
                  alt=""
                  className="aspect-[3/4] w-full rounded-card object-cover"
                />
              ) : (
                <div
                  key={photo.id}
                  className="flex aspect-[3/4] items-center justify-center rounded-card bg-surface-2 text-[11px] text-text-muted"
                >
                  Обрабатывается…
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}