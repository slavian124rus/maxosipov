'use client'

import { Button } from '@/components/ui/button'
import { formatWeight } from '@/modules/progression'

type Props = {
  durationMin: number
  exerciseCount: number
  volumeKg: number
  onClose: () => void
}

/** Сводка тренировки (DESIGN.md §8.5): время, упражнения, объём. */
export function FinishSummary({ durationMin, exerciseCount, volumeKg, onClose }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-1 px-4 py-5">
      <h2 className="text-[22px] font-semibold">Тренировка завершена</h2>

      <div className="flex flex-col gap-1 text-[15px] text-text-secondary">
        <p>Время: {durationMin} мин</p>
        <p>Упражнений: {exerciseCount}</p>
        <p>Объём: {formatWeight(volumeKg)}</p>
      </div>

      <p className="text-[13px] text-text-muted">Итог МаксИИма появится на следующем этапе</p>

      <Button type="button" onClick={onClose}>
        Готово
      </Button>
    </div>
  )
}