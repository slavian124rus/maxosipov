import { ClientBackLink } from '@/components/app/back-link'
import { requireClientPage } from '@/components/app/require-client-page'
import { MeasurementForm } from '@/components/progress/measurement-form'
import { getAccessForUser } from '@/modules/access'
import { listMeasurements } from '@/modules/body'
import { getGym } from '@/modules/gym'
import { formatWeight } from '@/modules/progression'
import { dayKey, formatLongDate } from '@/shared/dates'
import { deleteMeasurementAction } from './actions'

// Экран зависит от сессии и подписки (без подписки — только чтение).
export const instant = false

export default async function MeasurementsPage() {
  const { user, actor } = await requireClientPage('/progress')
  const gym = await getGym()
  const access = await getAccessForUser(user.id)
  const rows = await listMeasurements(actor, user.id, { limit: 200 })

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <ClientBackLink href="/progress" label="К прогрессу" />
      <h1 className="text-[22px] font-semibold">Замеры</h1>

      {access.hasAccess ? <MeasurementForm today={dayKey(new Date(), gym.timezone)} /> : null}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const values = [
            row.weightKg !== null ? `Вес ${formatWeight(Number(row.weightKg))}` : null,
            row.chestCm !== null ? `Грудь ${row.chestCm} см` : null,
            row.waistCm !== null ? `Талия ${row.waistCm} см` : null,
            row.hipsCm !== null ? `Бёдра ${row.hipsCm} см` : null,
            row.bicepsCm !== null ? `Бицепс ${row.bicepsCm} см` : null,
            row.thighCm !== null ? `Бедро ${row.thighCm} см` : null,
          ].filter(Boolean)

          return (
            <li
              key={row.id}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-4 py-3"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[17px]">
                  {formatLongDate(new Date(`${row.date}T00:00:00Z`), gym.timezone)}
                </span>
                {access.hasAccess ? (
                  <form action={deleteMeasurementAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="text-[13px] text-danger">
                      Удалить
                    </button>
                  </form>
                ) : null}
              </span>
              <span className="text-[15px] text-text-secondary">{values.join(' · ')}</span>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Замеров пока нет</p>
      ) : null}
    </main>
  )
}