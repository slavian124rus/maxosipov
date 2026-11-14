'use client'

import { useEffect, useState } from 'react'
import { addRest, remainingSeconds, type Rest } from '@/lib/rest-store'
import { Button } from '@/components/ui/button'

type Props = {
  /** Идущий отдых из памяти устройства: переживает уход со страницы. */
  rest: Rest
  onDone: () => void
  onSkip: () => void
  /** Компактная полоса для свободного режима: под логгером, без большого кольца. */
  compact?: boolean
}

/** Таймер отдыха: считает по часам (а не по тикам), поэтому не сбивается ни при уходе со страницы, ни в фоне. */
export function RestTimer({ rest, onDone, onSkip, compact = false }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const left = remainingSeconds(rest, now)
  const seconds = rest.seconds

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const finished = left <= 0
  useEffect(() => {
    if (!finished) return
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
    }
    onDone()
  }, [finished, onDone])

  const progress = seconds > 0 ? (seconds - left) / seconds : 1
  const minutes = Math.floor(left / 60)
  const restSeconds = left % 60

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 px-3 py-2">
        <span className="text-[13px] text-text-muted">Отдых</span>
        <span className="font-display text-[24px] tabular-nums">
          {minutes}:{String(restSeconds).padStart(2, '0')}
        </span>
        <div className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-surface-1">
          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Пропустить
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-1 px-4 py-6">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#202024" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#E5322D"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
          />
        </svg>
        <span className="font-display text-[56px] leading-none tabular-nums">
          {minutes}:{String(restSeconds).padStart(2, '0')}
        </span>
      </div>

      <div className="flex w-full gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => addRest(30)}>
          +30 с
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={onSkip}>
          Пропустить
        </Button>
      </div>
    </div>
  )
}