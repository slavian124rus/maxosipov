import Link from 'next/link'
import { muscleName } from '@/shared/muscles'
import type { ExerciseListItem } from '@/modules/catalog'

/** Строка каталога: постер 62×62, название, тренажёр, основные мышцы. */
export function ExerciseListItemRow({ item }: { item: ExerciseListItem }) {
  const primary = item.primaryMuscles.map(muscleName).join(', ')

  return (
    <Link
      href={`/exercises/${item.slug}`}
      className="flex items-center gap-3 rounded-card border border-border bg-surface-1 px-3 py-2.5"
    >
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка, оптимизатор Next её не знает
        <img
          src={item.posterUrl}
          alt=""
          width={62}
          height={62}
          className="h-[62px] w-[62px] shrink-0 rounded-[14px] object-cover"
        />
      ) : (
        <div className="h-[62px] w-[62px] shrink-0 rounded-[14px] bg-surface-2" />
      )}

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[17px] text-text">{item.name}</span>
        <span className="truncate text-[13px] text-text-muted">{item.machineName ?? 'Свободные веса'}</span>
        {primary ? (
          <span className="truncate text-[13px] text-text-secondary">Основные: {primary}</span>
        ) : null}
      </div>
    </Link>
  )
}
