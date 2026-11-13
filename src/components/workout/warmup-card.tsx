'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type WarmupCardItem = {
  title: string
  durationSec: number | null
  reps: number | null
  note: string | null
}

export type WarmupCardData = {
  name: string
  items: WarmupCardItem[]
  /** Общее время, минуты. */
  minutes: number
}

function amount(item: WarmupCardItem): string {
  if (item.durationSec) {
    return item.durationSec >= 60 && item.durationSec % 60 === 0
      ? `${item.durationSec / 60} мин`
      : `${item.durationSec} сек`
  }
  return item.reps ? `${item.reps} раз` : ''
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/**
 * Разминка — первая карточка тренировки. Не пишется в подходы и не влияет на веса:
 * только чек-лист, общий таймер и отметка «сделана / пропущена» (DESIGN.md §8.3).
 */
export function WarmupCard({
  data,
  status,
  onStatus,
}: {
  data: WarmupCardData
  status: 'done' | 'skipped' | null
  onStatus: (status: 'done' | 'skipped') => void
}) {
  const [open, setOpen] = useState(status === null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [elapsed, setElapsed] = useState(0)

  const running = open && status === null
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  function decide(next: 'done' | 'skipped'): void {
    onStatus(next)
    setOpen(false)
  }

  const title =
    status === 'done'
      ? 'Разминка · сделана'
      : status === 'skipped'
        ? 'Разминка · пропущена'
        : `Разминка · ${data.minutes} мин`

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 items-center justify-between gap-2 text-left"
      >
        <span className="text-[17px]">{title}</span>
        {status === 'done' ? <Check size={18} className="text-accent" aria-hidden /> : null}
        {running ? (
          <span className="text-[15px] text-text-secondary tabular-nums">{clock(elapsed)}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((item, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={`${item.title}-${index}`}>
                  <button
                    type="button"
                    aria-pressed={isChecked}
                    onClick={() =>
                      setChecked((current) => {
                        const next = new Set(current)
                        if (next.has(index)) next.delete(index)
                        else next.add(index)
                        return next
                      })
                    }
                    className="flex min-h-12 w-full items-center gap-3 rounded-control border border-border px-3 py-2 text-left"
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        isChecked ? 'border-accent bg-accent text-white' : 'border-border'
                      }`}
                    >
                      {isChecked ? <Check size={14} aria-hidden /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`text-[15px] ${isChecked ? 'text-text-muted line-through' : ''}`}>
                        {item.title}
                      </span>
                      {item.note ? <span className="text-[13px] text-text-muted">{item.note}</span> : null}
                    </span>
                    <span className="shrink-0 text-[13px] text-text-secondary">{amount(item)}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {status === null ? (
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => decide('done')}>
                Готово
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => decide('skipped')}>
                Пропустить
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
