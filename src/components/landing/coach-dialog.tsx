'use client'

import { ArrowRight, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { DialogLine } from '../../../content/landing'

type Proposal = {
  title: string
  note: string
  /** `readonly` — контент приходит из `LANDING_UI ... as const`. */
  rows: readonly { before: string; after: string }[]
  accept: string
  decline: string
}

type Props = {
  dialog: DialogLine[]
  avatar: string
  avatarNote: string
  proposal: Proposal
}

/** 300 мс между репликами — план, задача 1, шаг 2. */
const STEP_DELAY = 0.3

/** Карточка-предложение рисуется после ответа МаксИИма. */
const PROPOSAL_AFTER = 1

/**
 * Диалог с МаксИИмом (DESIGN.md §10.3): реплики появляются по очереди при прокрутке.
 * Это демонстрация интерфейса, а не рабочий чат — кнопки не интерактивны.
 */
export function CoachDialog({ dialog, avatar, avatarNote, proposal }: Props) {
  const reduced = useReducedMotion()

  const items: { key: string; delay: number; node: ReactNode }[] = []
  dialog.forEach((line, index) => {
    items.push({
      key: `line-${index}`,
      delay: items.length * STEP_DELAY,
      node: <Bubble line={line} />,
    })

    if (index === PROPOSAL_AFTER) {
      items.push({
        key: 'proposal',
        delay: items.length * STEP_DELAY,
        node: <ProposalCard proposal={proposal} />,
      })
    }
  })

  return (
    <div className="flex w-full flex-col gap-3 rounded-sheet border border-border bg-surface-1/80 p-4 md:max-w-[420px] md:p-5">
      <div className="flex items-center gap-3 border-b border-border/70 pb-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-muscle-primary/40 bg-muscle-primary/10 font-display text-[14px] text-text">
          {avatar}
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface-1 bg-muscle-primary"
          />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold text-text">МаксИИм</span>
          <span className="truncate text-[13px] text-text-secondary">{avatarNote}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <motion.div
            key={item.key}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: item.delay }}
          >
            {item.node}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Bubble({ line }: { line: DialogLine }) {
  const isClient = line.from === 'client'

  return (
    <p
      className={`max-w-[88%] px-4 py-2.5 text-[15px] leading-relaxed ${
        isClient
          ? 'ml-auto rounded-card rounded-br-md border border-border bg-surface-2 text-text'
          : 'mr-auto rounded-card rounded-bl-md border border-border bg-bg text-text'
      }`}
    >
      {line.text}
    </p>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-muscle-primary/30 bg-surface-2 p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px] font-semibold text-text">{proposal.title}</p>
        <p className="text-[13px] text-text-secondary">{proposal.note}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {proposal.rows.map((row) => (
          <li key={row.before} className="flex flex-col gap-1 border-t border-border/70 pt-2 first:border-0 first:pt-0">
            <span className="flex items-start gap-2 text-[13px] text-text-secondary">
              <Minus size={14} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
              {row.before}
            </span>
            <span className="flex items-start gap-2 text-[13px] font-semibold text-text">
              <ArrowRight
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-1 shrink-0 text-muscle-primary"
              />
              {row.after}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 pt-1">
        {/* `accent-pressed` вместо `accent`: белый текст 15 px на нём даёт контраст 5.8:1. */}
        <span className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-accent-pressed text-[15px] font-semibold text-white">
          {proposal.accept}
        </span>
        <span className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-border bg-surface-1 text-[15px] text-text-secondary">
          {proposal.decline}
        </span>
      </div>
    </div>
  )
}
