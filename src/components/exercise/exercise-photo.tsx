type Props = {
  /** Полноразмерное фото тренажёра (подписанная ссылка). */
  src: string | null
  /** Название тренажёра — для подписи к фото. */
  machineName: string | null
  name: string
}

/**
 * Фото тренажёра вместо плеера: пока видео нет, карточка не пустая (DESIGN.md §8.2).
 * Никаких кнопок воспроизведения и переключателя «Мышцы» — ролик ещё не снят.
 */
export function ExercisePhoto({ src, machineName, name }: Props) {
  if (!src) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-card bg-surface-2 px-6 text-center">
        <p className="text-[17px] text-text">{name}</p>
        <p className="text-[15px] text-text-secondary">Видео скоро</p>
      </div>
    )
  }

  return (
    <figure className="relative overflow-hidden rounded-card bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка, оптимизатор Next её не знает */}
      <img
        src={src}
        alt={`Тренажёр: ${machineName ?? name}`}
        className="aspect-[3/4] w-full object-cover"
      />

      <figcaption className="absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] text-white">Видео скоро</span>
      </figcaption>
    </figure>
  )
}
