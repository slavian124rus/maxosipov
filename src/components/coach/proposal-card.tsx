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

  // Решённые предложения не висят в чате полной карточкой — остаётся одна строка.
  if (proposal.status !== 'pending') {
    return <ProposalSummary proposal={proposal} />
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

      {
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
      }
    </div>
  )
}

const SUMMARY_LABEL: Record<string, { text: string; className: string }> = {
  accepted: { text: '✓ Принято', className: 'text-success' },
  rejected: { text: 'Отклонено', className: 'text-text-muted' },
  superseded: { text: 'Устарело — есть новее', className: 'text-text-muted' },
  reverted: { text: 'Откачено', className: 'text-text-muted' },
}

/** Одна строка вместо карточки; тап раскрывает, что менялось. */
function ProposalSummary({ proposal }: { proposal: ProposalCardData }) {
  const [open, setOpen] = useState(false)
  const label = SUMMARY_LABEL[proposal.status] ?? SUMMARY_LABEL.rejected!
  const count = proposal.lines.length

  return (
    <div className="rounded-card border border-border bg-surface-1 px-4 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={`text-[14px] ${label.className}`}>
          {label.text}
          {proposal.status === 'accepted' && count > 0 ? ` · изменений: ${count}` : ''}
        </span>
        {count > 0 ? <span className="text-[12px] text-text-muted">{open ? 'Скрыть' : 'Показать'}</span> : null}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-1">
          {proposal.lines.map((line, index) => {
            const sign = SIGN[line.kind] ?? SIGN.changed!
            return (
              <p key={`${index}-${line.text}`} className={`text-[13px] ${sign.className}`}>
                {sign.prefix}
                {line.text}
              </p>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}