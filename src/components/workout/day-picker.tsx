'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exercisesLabel } from '@/shared/plural'
import { pluralDays } from '@/shared/program-labels'

export type DayOption = { id: string; name: string; exercises: number }

/**
 * Смена дня тренировки на экране «Сегодня» (DESIGN.md §8.1): клиент не хочет сегодня
 * день ног — выбирает другой день своей программы. Обычно идём по порядку, поэтому
 * рекомендованный день отмечен, а не навязан.
 */
export function DayPicker({ days, recommendedId }: { days: DayOption[]; recommendedId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
        Сменить день
      </Button>

      <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Выбери день</DialogTitle>
          <DialogDescription>
            {days.length === 1
              ? 'В программе один день — можно выбрать его'
              : `В программе ${days.length} ${pluralDays(days.length)}. Обычно идём по порядку, но можно взять любой`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {days.map((day, index) => (
            <Link
              key={day.id}
              href={`/workout?day=${day.id}`}
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center gap-3 rounded-control border border-border bg-surface-1 px-3 py-2 hover:bg-surface-2/60"
            >
              <span className="font-display text-[20px] leading-none text-accent">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] text-text">{day.name}</span>
                <span className="text-[13px] text-text-muted">{exercisesLabel(day.exercises)}</span>
              </span>
              {day.id === recommendedId ? (
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-text-secondary">
                  рекомендуем
                </span>
              ) : null}
            </Link>
          ))}
        </div>

        <p className="text-[13px] text-text-muted">
          Если тренировка уже начата, она завершится при выборе другого дня — записанные подходы
          останутся в истории.
        </p>
      </DialogContent>
    </Dialog>
  )
}
