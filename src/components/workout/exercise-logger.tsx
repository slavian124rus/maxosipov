'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatWeight } from '@/modules/progression'

type Props = {
  setNumber: number
  stepKg: number
  initialWeightKg: number
  initialReps: number
  onLog: (weightKg: number, reps: number) => void
  /** `bodyweight` — вес не спрашиваем; `bodyweight_plus` — «Доп. вес», 0 = свой вес. */
  loadType?: 'external' | 'bodyweight' | 'bodyweight_plus'
}

/** Вес и повторения крупными степперами, шаг веса — шаг тренажёра. */
export function ExerciseLogger({
  setNumber,
  stepKg,
  initialWeightKg,
  initialReps,
  onLog,
  loadType = 'external',
}: Props) {
  const showWeight = loadType !== 'bodyweight'
  const [weight, setWeight] = useState(initialWeightKg)
  const [reps, setReps] = useState(initialReps)

  const round = (value: number): number => Math.max(0, Math.round(value * 100) / 100)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {showWeight ? (
        <div className="flex flex-1 flex-col items-center gap-2 rounded-card border border-border bg-surface-2 py-2">
          <span className="text-[13px] text-text-muted">
            {loadType === 'bodyweight_plus' ? 'Доп. вес' : 'Вес'}
          </span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWeight((value) => round(value - stepKg))}
              aria-label="Меньше вес"
            >
              −
            </Button>
            <span className="font-display text-[28px] tabular-nums">
              {loadType === 'bodyweight_plus' && weight === 0 ? 'свой вес' : formatWeight(weight)}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWeight((value) => round(value + stepKg))}
              aria-label="Больше вес"
            >
              +
            </Button>
          </div>
        </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center gap-2 rounded-card border border-border bg-surface-2 py-2">
          <span className="text-[13px] text-text-muted">Повторения</span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReps((value) => Math.max(1, value - 1))}
              aria-label="Меньше повторений"
            >
              −
            </Button>
            <span className="font-display text-[28px] tabular-nums">{reps}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReps((value) => value + 1)}
              aria-label="Больше повторений"
            >
              +
            </Button>
          </div>
        </div>
      </div>

      <Button type="button" onClick={() => onLog(showWeight ? weight : 0, reps)}>
        Записать подход {setNumber}
      </Button>
    </div>
  )
}