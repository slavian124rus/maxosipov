'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  seconds: number
  onDone: () => void
  onSkip: () => void
  /** Компактная полоса для свободного режима: под логгером, без большого кольца. */
  compact?: boolean
}

/** Таймер отдыха: крупные цифры, кольцо прогресса, вибрация в конце. */
export function RestTimer({ seconds, onDone, onSkip, compact = false }: Props) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (left <= 0) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
      onDone()
      return
    }

    const timer = setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [left, onDone])

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
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setLeft(left + 30)}>
          +30 с
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={onSkip}>
          Пропустить
        </Button>
      </div>
    </div>
  )
}