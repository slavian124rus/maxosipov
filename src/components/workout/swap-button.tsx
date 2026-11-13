'use client'

import { Repeat } from 'lucide-react'

/** «Занято? Заменить»: открывает список запасных упражнений от тренера. */
export function SwapButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center gap-2 self-start rounded-control border border-border px-3 text-[14px] text-text-secondary"
    >
      <Repeat size={16} strokeWidth={1.75} aria-hidden />
      Занято? Заменить
    </button>
  )
}
