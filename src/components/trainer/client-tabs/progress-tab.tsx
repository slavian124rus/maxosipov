import type { ClientCard } from '@/modules/trainer'
import { formatWeight } from '@/modules/progression'
import { addTrainerMeasurementAction } from '@/app/(app)/app/trainer/clients/actions'

function dateRu(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00+07:00`))
}

/** Вкладка «Прогресс»: замеры и фото (фото — только при `clients.view_photos`). */
export function ProgressTab({ card, today }: { card: ClientCard; today: string }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Замеры</h2>

        {card.measurements.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Замеров пока нет</p>
        ) : (
          card.measurements.slice(0, 12).map((measurement) => (
            <div
              key={measurement.id}
              className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-1 px-3 py-2"
            >
              <span className="text-[15px] text-text">{dateRu(measurement.date)}</span>
              <span className="text-[13px] text-text-secondary">
                {measurement.weightKg !== null ? formatWeight(measurement.weightKg) : ''}
                {measurement.waistCm !== null ? ` · талия ${measurement.waistCm} см` : ''}
              </span>
            </div>
          ))
        )}

        {card.permissions.measurements ? (
          <form
            action={addTrainerMeasurementAction}
            className="flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
          >
            <input type="hidden" name="clientId" value={card.id} />
            <label className="flex flex-col gap-1 text-[13px] text-text-muted">
              Дата
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                className="h-11 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-text-muted">
              Вес, кг
              <input
                name="weightKg"
                inputMode="decimal"
                placeholder="—"
                className="h-11 w-20 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-text-muted">
              Талия, см
              <input
                name="waistCm"
                inputMode="decimal"
                placeholder="—"
                className="h-11 w-20 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
              />
            </label>
            <button type="submit" className="h-11 rounded-control bg-surface-2 px-3 text-[15px] text-text">
              Добавить
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Фото «до/после»</h2>

        {!card.permissions.viewPhotos ? (
          <p className="text-[15px] text-text-secondary">Фото тебе не видны</p>
        ) : card.photos.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Фотографий пока нет</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {card.photos.slice(0, 9).map((photo) => (
              <div key={photo.id} className="flex flex-col gap-1">
                {photo.thumbUrl ? (
                  // Подписанная ссылка на миниатюру; Next/Image для неё не нужен.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbUrl}
                    alt={`Фото ${photo.date}`}
                    className="aspect-[3/4] w-full rounded-control object-cover"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full rounded-control bg-surface-2" />
                )}
                <span className="text-[11px] text-text-muted">{dateRu(photo.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}