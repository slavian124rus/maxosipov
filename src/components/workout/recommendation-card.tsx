'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatWeight } from '@/modules/progression'

type Props = {
  text: string
  weightKg: number | null
  action?: 'increase' | 'keep' | 'decrease' | 'none'
  /** Ссылка «Почему?» в чат МаксИИма (этап 4). */
  whyHref?: string
  onAccept: () => void | Promise<void>
  onKeep: () => void | Promise<void>
}

/** Подсказка алгоритма и выбор «на следующий раз» (DESIGN.md §8.3). */
export function RecommendationCard({
  text,
  weightKg,
  action,
  whyHref,
  onAccept,
  onKeep,
}: Props) {
  const [decided, setDecided] = useState<null | { kind: 'accepted' | 'kept' }>(null)
  const [busy, setBusy] = useState(false)

  async function decide(kind: 'accepted' | 'kept'): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      await (kind === 'accepted' ? onAccept() : onKeep())
      setDecided({ kind })
    } finally {
      setBusy(false)
    }
  }

  // После решения карточка сворачивается в одну строку; «Изменить» возвращает выбор.
  if (decided) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-success/40 bg-surface-1 px-4 py-3">
        <p className="text-[15px] text-success">
          {decided.kind === 'accepted' && weightKg !== null
            ? `✓ В следующий раз: ${formatWeight(weightKg)}`
            : '✓ Оставили как есть'}
        </p>
        <button type="button" className="text-[13px] text-accent" onClick={() => setDecided(null)}>
          Изменить
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <p className="text-[15px] text-text">
        {weightKg === null ? text : `В следующий раз: ${formatWeight(weightKg)}${action === 'increase' ? ' ↑' : action === 'decrease' ? ' ↓' : ''}`}
      </p>
      <p className="text-[13px] text-text-muted">{text}</p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" disabled={busy} onClick={() => void decide('accepted')}>
          {busy ? 'Сохраняю…' : 'Принять'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void decide('kept')}
        >
          Оставить как есть
        </Button>
      </div>
      {whyHref ? (
        <Link href={whyHref} className="self-start text-[13px] text-accent">
          Почему?
        </Link>
      ) : null}
    </div>
  )
}