'use client'

import { useActionState, useRef, useState } from 'react'
import { CalendarClock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { pluralRu } from '@/shared/plural'
import { INITIAL_GRANT_STATE } from '@/app/(app)/app/trainer/subscriptions/grant-state'
import { grantSubscriptionAction } from '@/app/(app)/app/trainer/subscriptions/actions'

export type GrantOption = {
  months: 1 | 3 | 6 | 12
  /** Подпись кнопки: «+1 мес». */
  label: string
  /** До какой даты дойдёт доступ — считает сервер по часовому поясу зала. */
  untilLabel: string
}

type Props = {
  clientId: string
  clientName: string
  /** Текущее состояние доступа словами: «сейчас до 5 декабря 2026» / «доступа нет». */
  currentLabel: string
  options: GrantOption[]
  /** Цена и заметка для истории платежей (в списке подписок они есть, в карточке — нет). */
  withPrice?: boolean
  defaultPrice?: number | null
  /** Выдача до конкретной даты — на экране подписок. */
  withUntilDate?: boolean
}

/** «2027-01-05» → «5 января 2027» для подписи в подтверждении. */
export function formatDateInput(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(Date.UTC(year, month - 1, day, 5)))
    .replace(/\s*г\.$/, '')
}

/**
 * Продление подписки (DESIGN.md §8.9): кнопка → подтверждение «Продлить подписку?»
 * с точной датой → после сохранения понятное «Выдано до 5 января 2027».
 * Один компонент на карточку клиента и на список подписок, чтобы поведение совпадало.
 */
export function GrantSubscription({
  clientId,
  clientName,
  currentLabel,
  options,
  withPrice = false,
  defaultPrice = null,
  withUntilDate = false,
}: Props) {
  const [state, formAction, pending] = useActionState(grantSubscriptionAction, INITIAL_GRANT_STATE)
  const [confirming, setConfirming] = useState<GrantOption | null>(null)
  const [untilDate, setUntilDate] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const monthsInput = useRef<HTMLInputElement>(null)
  const untilInput = useRef<HTMLInputElement>(null)

  /** Подтвердили — подставляем срок в скрытые поля и отправляем форму. */
  function submitGrant(months: number | null, until: string | null): void {
    if (monthsInput.current) monthsInput.current.value = months === null ? '' : String(months)
    if (untilInput.current) untilInput.current.value = until ?? ''
    setConfirming(null)
    formRef.current?.requestSubmit()
  }

  const monthsWord = state.months
    ? pluralRu(state.months, ['месяц', 'месяца', 'месяцев'])
    : null

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={clientId} />
      <input ref={monthsInput} type="hidden" name="months" defaultValue="" />
      <input ref={untilInput} type="hidden" name="untilDate" defaultValue="" />

      {withPrice ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`price-${clientId}`}>Цена, ₽</Label>
          <Input
            id={`price-${clientId}`}
            name="priceRub"
            inputMode="numeric"
            defaultValue={defaultPrice ?? ''}
          />
          <Label htmlFor={`note-${clientId}`}>Заметка</Label>
          <Input id={`note-${clientId}`} name="note" placeholder="Оплатил наличными" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.months}
            type="button"
            variant={option.months === 1 ? 'default' : 'secondary'}
            onClick={() => setConfirming(option)}
            disabled={pending}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {withUntilDate ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`until-${clientId}`}>До даты</Label>
            <Input
              id={`until-${clientId}`}
              type="date"
              value={untilDate}
              onChange={(event) => setUntilDate(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !untilDate}
            onClick={() =>
              setConfirming({
                months: 1,
                label: 'До даты',
                untilLabel: untilDate ? formatDateInput(untilDate) : '—',
              })
            }
          >
            Выдать
          </Button>
        </div>
      ) : null}


      {state.error ? (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      ) : null}

      {state.untilLabel ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-card border border-success/40 bg-surface-1 px-4 py-3"
        >
          <Check size={18} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-success" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[15px] text-success">{state.untilLabel}</p>
            <p className="text-[13px] text-text-muted">
              {monthsWord
                ? `Подписка продлена на ${state.months} ${monthsWord}`
                : 'Подписка выдана до выбранной даты'}
            </p>
          </div>
        </div>
      ) : null}

      <Dialog
        open={confirming !== null}
        onOpenChange={(next) => (next ? undefined : setConfirming(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Продлить подписку?</DialogTitle>
            <DialogDescription>
              {clientName || 'Клиент'} · {currentLabel}
              {confirming ? ` → до ${confirming.untilLabel}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-[13px] text-text-secondary">
            <CalendarClock size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              {confirming && confirming.label !== 'До даты'
                ? `Доступ продлится на ${confirming.months} ${pluralRu(confirming.months, ['месяц', 'месяца', 'месяцев'])} и будет действовать до ${confirming.untilLabel}.`
                : `Доступ будет действовать до ${confirming?.untilLabel ?? '—'}.`}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                confirming &&
                submitGrant(
                  confirming.label === 'До даты' ? null : confirming.months,
                  confirming.label === 'До даты' ? untilDate : null,
                )
              }
            >
              {pending ? 'Продлеваем…' : 'Да, продлить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
