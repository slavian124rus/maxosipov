'use client'

import { Button } from '@/components/ui/button'

export type Feeling = 'easy' | 'good' | 'hard'

const OPTIONS: { value: Feeling; label: string }[] = [
  { value: 'easy', label: 'Легко' },
  { value: 'good', label: 'Отлично' },
  { value: 'hard', label: 'Тяжело' },
]

/** Ощущение упражнения после последнего подхода (DESIGN.md §8.3). */
export function FeelingPicker({ onPick }: { onPick: (feeling: Feeling) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] text-text-secondary">Как прошло упражнение?</p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => onPick(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}