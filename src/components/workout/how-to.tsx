'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type HowToExercise = {
  name: string
  slug: string
  machineName: string | null
  videoMp4Url: string | null
  videoWebmUrl: string | null
  posterUrl: string | null
  steps: string[]
  mistakes: string[]
  tips: string | null
}

/**
 * «Как делать» прямо с тренировки (DESIGN.md §8.3): клиент стоит у тренажёра и хочет
 * посмотреть технику — видео с управлением, шаги, частые ошибки и совет, без ухода
 * со страницы тренировки (записанные подходы остаются на месте).
 */
export function HowToDialog({
  exercise,
  open,
  onOpenChange,
}: {
  exercise: HowToExercise | null
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92dvh] w-full grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-[17px] leading-tight">
            {exercise?.name ?? 'Упражнение'}
          </DialogTitle>
          <DialogDescription>{exercise?.machineName ?? 'Свободные веса'}</DialogDescription>
        </DialogHeader>

        {exercise ? (
          <div className="flex min-w-0 flex-col gap-4">
            {exercise.videoMp4Url ? (
              <video
                className="aspect-[4/5] w-full rounded-card bg-black object-cover"
                src={exercise.videoMp4Url}
                poster={exercise.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : exercise.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка
              <img
                src={exercise.posterUrl}
                alt={`Тренажёр: ${exercise.machineName ?? exercise.name}`}
                className="w-full rounded-card object-cover"
              />
            ) : (
              <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-text-secondary">
                Видео и фото пока нет — смотри шаги ниже.
              </p>
            )}

            {exercise.steps.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-[17px] font-semibold">Как делать</h3>
                <ol className="flex flex-col gap-2">
                  {exercise.steps.map((step, index) => (
                    <li key={`${index}-${step}`} className="flex gap-3">
                      <span className="font-display text-[18px] text-accent">{index + 1}</span>
                      <span className="text-[15px] text-text-secondary">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {exercise.mistakes.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-[17px] font-semibold">Частые ошибки</h3>
                <ul className="flex flex-col gap-1.5">
                  {exercise.mistakes.map((mistake) => (
                    <li key={mistake} className="text-[15px] text-text-secondary">
                      {mistake}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {exercise.tips ? (
              <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-text-secondary">
                {exercise.tips}
              </p>
            ) : null}

            <Button asChild variant="secondary" className="w-fit">
              <Link href={`/exercises/${exercise.slug}`}>Открыть карточку упражнения</Link>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Кнопка «Как делать»: на телефоне — только иконка, подпись появляется на широком экране. */
export function HowToButton({
  onClick,
  className = '',
  compact = false,
  label,
}: {
  onClick: () => void
  className?: string
  compact?: boolean
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      aria-label={label}
      className={`min-h-10 shrink-0 ${className}`}
    >
      <BookOpen size={16} strokeWidth={1.75} aria-hidden />
      <span className={compact ? 'hidden sm:inline' : undefined}>Как делать</span>
    </Button>
  )
}
