'use client'

import { Button } from '@/components/ui/button'
import { formatWeight } from '@/modules/progression'

type Props = {
  text: string
  weightKg: number | null
  action?: 'increase' | 'keep' | 'decrease' | 'none'
  onAccept: () => void
  onKeep: () => void
}

/** Подсказка алгоритма и выбор «на следующий раз» (DESIGN.md §8.3). */
export function RecommendationCard({ text, weightKg, action, onAccept, onKeep }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <p className="text-[15px] text-text">
        {weightKg === null ? text : `В следующий раз: ${formatWeight(weightKg)}${action === 'increase' ? ' ↑' : action === 'decrease' ? ' ↓' : ''}`}
      </p>
      <p className="text-[13px] text-text-muted">{text}</p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={onAccept}>
          Принять
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onKeep}>
          Оставить как есть
        </Button>
      </div>
    </div>
  )
}