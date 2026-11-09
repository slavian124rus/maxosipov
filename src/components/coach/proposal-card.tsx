'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProposalCard as ProposalCardData } from '@/modules/coach-ai'

const SIGN: Record<string, { prefix: string; className: string }> = {
  added: { prefix: '+ ', className: 'text-success' },
  removed: { prefix: '− ', className: 'text-danger' },
  changed: { prefix: '→ ', className: 'text-text' },
  moved: { prefix: '', className: 'text-text-secondary' },
}

/** Предложение изменения программы (DESIGN.md §8.6). */
export function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: ProposalCardData
  onDecide: (id: string, action: 'accept' | 'reject') => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function decide(action: 'accept' | 'reject'): Promise<void> {
    setBusy(true)
    try {
      await onDecide(proposal.id, action)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <p className="text-[15px] font-semibold">Что изменится</p>

      <div className="flex flex-col gap-1">
        {proposal.lines.length === 0 ? (
          <p className="text-[15px] text-text-secondary">Без изменений в упражнениях</p>
        ) : (
          proposal.lines.map((line, index) => {
            const sign = SIGN[line.kind] ?? SIGN.changed!
            return (
              <p key={`${index}-${line.text}`} className={`text-[15px] ${sign.className}`}>
                {sign.prefix}
                {line.text}
              </p>
            )
          })
        )}
      </div>

      {proposal.rationale ? (
        <p className="text-[13px] text-text-muted">{proposal.rationale}</p>
      ) : null}

      {proposal.status === 'pending' ? (
        <div className="flex gap-2">
          <Button type="button" className="flex-1" disabled={busy} onClick={() => void decide('accept')}>
            Принять
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => void decide('reject')}
          >
            Не надо
          </Button>
        </div>
      ) : proposal.status === 'accepted' ? (
        <p className="text-[15px] text-success">Принято ✓</p>
      ) : (
        <p className="text-[15px] text-text-muted">Отклонено</p>
      )}
    </div>
  )
}