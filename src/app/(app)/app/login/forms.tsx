'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestCodeAction, resendCodeAction, verifyCodeAction, type FormState } from './actions'

const INITIAL: FormState = { error: null }

/** Маска `+7 (999) 123-45-67` по мере ввода. */
export function maskPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (digits.startsWith('7')) digits = digits.slice(1)
  digits = digits.slice(0, 10)

  if (!digits) return ''

  let masked = `+7 (${digits.slice(0, 3)}`
  if (digits.length >= 3) masked += ')'
  if (digits.length > 3) masked += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) masked += `-${digits.slice(6, 8)}`
  if (digits.length > 8) masked += `-${digits.slice(8, 10)}`
  return masked
}

export function PhoneForm({ linkId }: { linkId?: string }) {
  const [state, formAction, pending] = useActionState(requestCodeAction, INITIAL)
  const [value, setValue] = useState('')

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {linkId ? <input type="hidden" name="link" value={linkId} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <Input
          id="phone"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 (___) ___-__-__"
          value={value}
          onChange={(event) => setValue(maskPhone(event.target.value))}
          autoFocus
        />
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Отправляем…' : 'Получить код'}
      </Button>
    </form>
  )
}

export function CodeForm({ phone, linkId }: { phone: string; linkId?: string }) {
  const [state, formAction, pending] = useActionState(verifyCodeAction, INITIAL)
  const [digits, setDigits] = useState(['', '', '', ''])
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendPending, startResend] = useTransition()

  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const formRef = useRef<HTMLFormElement>(null)

  const code = digits.join('')

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  useEffect(() => {
    if (code.length === 4 && !pending) formRef.current?.requestSubmit()
  }, [code, pending])

  function setDigit(index: number, value: string): void {
    const digit = value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < 3) inputs.current[index + 1]?.focus()
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return
    event.preventDefault()
    const next = pasted.split('')
    setDigits([next[0] ?? '', next[1] ?? '', next[2] ?? '', next[3] ?? ''])
    inputs.current[Math.min(next.length, 4) - 1]?.focus()
  }

  function resend(): void {
    startResend(async () => {
      const result = await resendCodeAction(phone)
      setResendError(result.error)
      if (!result.error) setSecondsLeft(60)
    })
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="code" value={code} />
      {linkId ? <input type="hidden" name="link" value={linkId} /> : null}

      <div className="flex justify-between gap-3">
        {[0, 1, 2, 3].map((index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element
            }}
            value={digits[index] ?? ''}
            onChange={(event) => setDigit(index, event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && !digits[index] && index > 0) {
                inputs.current[index - 1]?.focus()
              }
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Цифра ${index + 1} из 4`}
            className="h-16 w-full rounded-control border border-border bg-surface-1 text-center font-display text-[28px] text-text outline-none focus-visible:border-accent"
          />
        ))}
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {resendError ? <p className="text-[15px] text-danger">{resendError}</p> : null}

      <Button type="submit" disabled={pending || code.length !== 4}>
        {pending ? 'Проверяем…' : 'Подтвердить'}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={resend}
        disabled={secondsLeft > 0 || resendPending}
      >
        {secondsLeft > 0 ? `Отправить код ещё раз через ${secondsLeft} с` : 'Отправить код ещё раз'}
      </Button>
    </form>
  )
}
