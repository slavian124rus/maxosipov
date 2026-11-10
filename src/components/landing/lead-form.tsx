'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { INITIAL_LEAD_STATE, type LeadFormState } from '@/app/(site)/lead-state'
import { LANDING_UI } from '../../../content/landing'

type Props = {
  action: (previous: LeadFormState, formData: FormData) => Promise<LeadFormState>
}

const TEXT = LANDING_UI.lead

/**
 * Форма заявки под блоком «Как начать» (план, задача 3). Кнопка блокируется на время
 * отправки, а повторное нажатие не создаёт вторую заявку — дубль номера за 10 минут
 * модуль `landing` отбрасывает.
 */
export function LeadForm({ action }: Props) {
  const [state, formAction] = useActionState(action, INITIAL_LEAD_STATE)

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-success/40 bg-success/10 px-6 py-8 text-center">
        <p role="status" className="font-display text-[22px] font-medium text-text">
          {TEXT.success}
        </p>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-1 p-5 md:p-6"
    >
      <p className="text-[17px] leading-snug font-semibold text-text md:text-[20px]">{TEXT.title}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-name" className="text-[13px] font-semibold text-text-secondary">
            {TEXT.nameLabel}
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            autoComplete="given-name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={state.name}
            placeholder={TEXT.namePlaceholder}
            className="h-12 w-full rounded-control border border-border bg-bg px-3 text-[15px] text-text outline-none placeholder:text-text-secondary/70 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="lead-phone" className="text-[13px] font-semibold text-text-secondary">
            {TEXT.phoneLabel}
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={state.phone}
            placeholder={TEXT.phonePlaceholder}
            className="h-12 w-full rounded-control border border-border bg-bg px-3 text-[15px] text-text outline-none placeholder:text-text-secondary/70 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-[13px] leading-relaxed text-text-secondary">
        <input
          type="checkbox"
          name="consent"
          required
          defaultChecked={state.consent}
          className="mt-0.5 size-5 shrink-0 accent-accent"
        />
        <span>
          {TEXT.consent} (
          <Link href="/legal/consent" className="underline underline-offset-4 hover:text-text">
            {TEXT.consentLink}
          </Link>
          )
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}

/** `useFormStatus` работает только внутри формы — поэтому отдельный компонент. */
function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center justify-center rounded-control border border-border bg-surface-2 px-6 text-[15px] font-semibold text-text transition-colors hover:border-muscle-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
    >
      {pending ? TEXT.pending : TEXT.submit}
    </button>
  )
}
