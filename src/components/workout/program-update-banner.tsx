'use client'

import { Button } from '@/components/ui/button'

/** Плашка «Максим обновил программу»: подходы остаются, обновляем только вид (F22). */
export function ProgramUpdateBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-warning/40 bg-surface-2 px-4 py-3">
      <p className="text-[15px] text-text">Максим обновил программу</p>
      <Button type="button" size="sm" onClick={onRefresh}>
        Обновить
      </Button>
    </div>
  )
}