'use client'

import { ArrowRight, Check, Minus, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DemoScenario } from '../../../content/landing'

type Proposal = {
  title: string
  note: string
  /** `readonly` — контент приходит из `LANDING_UI ... as const`. */
  rows: readonly { before: string; after: string }[]
  accept: string
  accepted: string
  decline: string
  declined: string
}

type Props = {
  scenarios: readonly DemoScenario[]
  avatar: string
  avatarNote: string
  proposal: Proposal
  hint: string
  greeting: string
  note: string
  typingLabel: string
  resetLabel: string
}

type Step = 'idle' | 'typing' | 'answered'
type Decision = 'pending' | 'accepted' | 'declined'

/** Сколько «печатает» МаксИИм перед ответом. */
const TYPING_MS = 900

/**
 * Живая демонстрация МаксИИма. Это не чат: ответы заготовлены, ничего не отправляется.
 * Показывает главное правило продукта — МаксИИм только предлагает, применяет человек
 * (кнопки «Принять» / «Не надо» меняют вид карточки), а про боль сразу говорит «Остановись».
 */
export function CoachDialog({
  scenarios,
  avatar,
  avatarNote,
  proposal,
  hint,
  greeting,
  note,
  typingLabel,
  resetLabel,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [decision, setDecision] = useState<Decision>('pending')
  const timer = useRef<number | undefined>(undefined)
  const logRef = useRef<HTMLDivElement>(null)

  const scenario = scenarios.find((item) => item.id === activeId) ?? null

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Прокручиваем только внутреннюю ленту диалога, не страницу.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [step, decision, activeId])

  const ask = (id: string) => {
    window.clearTimeout(timer.current)
    setActiveId(id)
    setDecision('pending')

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStep('answered')
      return
    }
    setStep('typing')
    timer.current = window.setTimeout(() => setStep('answered'), TYPING_MS)
  }

  const reset = () => {
    window.clearTimeout(timer.current)
    setActiveId(null)
    setStep('idle')
    setDecision('pending')
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-sheet border border-border bg-surface-1/80 p-4 md:max-w-[460px] md:p-5">
      <div className="flex items-center gap-3 border-b border-border/70 pb-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-muscle-primary/40 bg-muscle-primary/10 font-display text-[14px] text-text">
          {avatar}
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface-1 bg-success"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-text">МаксИИм</span>
          <span className="truncate text-[13px] text-text-secondary">{avatarNote}</span>
        </span>
        {scenario ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
            {resetLabel}
          </button>
        ) : null}
      </div>

      <div
        ref={logRef}
        aria-live="polite"
        className="flex h-[340px] flex-col gap-3 overflow-y-auto pr-1 md:h-[360px]"
      >
        {scenario ? (
          <>
            <p className="ml-auto max-w-[88%] rounded-card rounded-br-md border border-border bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed text-text">
              {scenario.prompt}
            </p>

            {step === 'typing' ? (
              <p
                role="status"
                className="mr-auto flex items-center gap-1.5 rounded-card rounded-bl-md border border-border bg-bg px-4 py-3"
              >
                <span className="sr-only">{typingLabel}</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    aria-hidden="true"
                    style={{ animationDelay: `${dot * 150}ms` }}
                    className="size-2 rounded-full bg-text-muted motion-safe:animate-bounce"
                  />
                ))}
              </p>
            ) : null}

            {step === 'answered' ? (
              <>
                <p className="mr-auto max-w-[92%] rounded-card rounded-bl-md border border-border bg-bg px-4 py-2.5 text-[15px] leading-relaxed text-text">
                  {scenario.answer}
                </p>
                {scenario.proposal ? (
                  <ProposalCard proposal={proposal} decision={decision} onDecide={setDecision} />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="mr-auto max-w-[92%] rounded-card rounded-bl-md border border-border bg-bg px-4 py-2.5 text-[15px] leading-relaxed text-text">
            {greeting}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
        <p className="text-[13px] font-semibold text-text-secondary">{hint}</p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => ask(item.id)}
                className={`min-h-11 rounded-full border px-4 py-2 text-left text-[14px] leading-snug transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                  active
                    ? 'border-muscle-primary/60 bg-muscle-primary/10 text-text'
                    : 'border-border bg-surface-2 text-text-secondary hover:border-muscle-primary/40 hover:text-text'
                }`}
              >
                {item.prompt}
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-text-muted">{note}</p>
      </div>
    </div>
  )
}

function ProposalCard({
  proposal,
  decision,
  onDecide,
}: {
  proposal: Proposal
  decision: Decision
  onDecide: (value: Decision) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-muscle-primary/30 bg-surface-2 p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px] font-semibold text-text">{proposal.title}</p>
        <p className="text-[13px] text-text-secondary">{proposal.note}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {proposal.rows.map((row) => (
          <li key={row.before} className="flex flex-col gap-1 border-t border-border/70 pt-2 first:border-0 first:pt-0">
            <span
              className={`flex items-start gap-2 text-[13px] text-text-secondary ${
                decision === 'accepted' ? 'line-through opacity-60' : ''
              }`}
            >
              <Minus size={14} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
              <span className="min-w-0">{row.before}</span>
            </span>
            <span className="flex items-start gap-2 text-[13px] font-semibold text-text">
              <ArrowRight
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-1 shrink-0 text-muscle-primary"
              />
              <span className="min-w-0">{row.after}</span>
            </span>
          </li>
        ))}
      </ul>

      {decision === 'pending' ? (
        <div className="flex gap-2 pt-1">
          {/* `accent-pressed` вместо `accent`: белый текст 15 px на нём даёт контраст 5.8:1. */}
          <button
            type="button"
            onClick={() => onDecide('accepted')}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-accent-pressed text-[15px] font-semibold text-white transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {proposal.accept}
          </button>
          <button
            type="button"
            onClick={() => onDecide('declined')}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-border bg-surface-1 text-[15px] text-text-secondary transition-colors hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {proposal.decline}
          </button>
        </div>
      ) : (
        <p
          role="status"
          className={`flex h-11 items-center justify-center gap-2 rounded-control text-[15px] font-semibold ${
            decision === 'accepted' ? 'bg-success/15 text-success' : 'bg-surface-1 text-text-secondary'
          }`}
        >
          {decision === 'accepted' ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
          {decision === 'accepted' ? proposal.accepted : proposal.declined}
        </p>
      )}
    </div>
  )
}
