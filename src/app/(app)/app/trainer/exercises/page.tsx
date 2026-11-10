import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listExercises } from '@/modules/catalog'

// Кабинет зависит от сессии и прав.
export const instant = false

const VIDEO_LABEL: Record<string, string> = {
  uploaded: 'Ждёт обработки',
  processing: 'Обрабатывается…',
  ready: 'Готово',
  failed: 'Ошибка',
}

export default async function TrainerExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { actor } = await requireUser()
  const { tab = 'published' } = await searchParams

  const canEdit = can(actor, 'catalog.edit')
  const status = tab === 'draft' ? 'draft' : 'published'
  const items = await listExercises({ status })

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold">Упражнения</h1>
        {canEdit ? (
          <Link
            href="/trainer/exercises/new"
            className="rounded-control bg-accent px-3 py-2 text-[15px] text-white"
          >
            Добавить
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2">
        {[
          { value: 'published', label: 'Опубликованы' },
          { value: 'draft', label: 'Черновики' },
        ].map((option) => (
          <Link
            key={option.value}
            href={`/trainer/exercises?tab=${option.value}`}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              status === option.value
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/trainer/exercises/${item.id}`}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-4 py-3"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[17px]">{item.name}</span>
                {item.hasMuscles ? (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-gold">
                    Мышцы на видео
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] text-text-muted">
                {item.machineName ?? 'Без тренажёра'} ·{' '}
                {item.hasVideo
                  ? `видео: ${VIDEO_LABEL[item.videoStatus ?? ''] ?? item.videoStatus ?? 'нет'}`
                  : item.thumbUrl
                    ? 'видео нет — в каталоге фото тренажёра'
                    : 'видео нет'}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-[15px] text-text-secondary">
          {status === 'draft' ? 'Черновиков нет' : 'Опубликованных упражнений нет'}
        </p>
      ) : null}
    </main>
  )
}
