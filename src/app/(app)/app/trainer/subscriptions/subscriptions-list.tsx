'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  disableAction,
  freezeAction,
  grantMonthsAction,
  grantUntilAction,
  unfreezeAction,
} from './actions'

export type SubscriptionRowView = {
  id: string
  name: string
  contact: string
  statusLabel: string
  endsAtLabel: string | null
  tone: 'normal' | 'warning' | 'danger'
  isFrozen: boolean
  history: { id: string; label: string; date: string }[]
}

export function SubscriptionsList({
  rows,
  defaultPrice,
}: {
  rows: SubscriptionRowView[]
  defaultPrice: number | null
}) {
  const [selected, setSelected] = useState<SubscriptionRowView | null>(null)
  const [confirmDisable, setConfirmDisable] = useState(false)

  return (
    <>
      <div className="overflow-hidden rounded-card border border-border">
        {/* Шапка таблицы — только на ПК; на телефоне это карточки. */}
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_260px] items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-2.5 text-[12px] tracking-wide text-text-muted uppercase lg:grid">
          <span>Клиент</span>
          <span>Контакт</span>
          <span className="text-right">Доступ</span>
        </div>

        <ul className="flex flex-col divide-y divide-border/60 bg-surface-1">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left hover:bg-surface-2/50 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_260px]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[17px] lg:text-[15px]">
                    {row.name || 'Без имени'}
                  </span>
                  <span className="truncate text-[13px] text-text-muted lg:hidden">
                    {row.contact}
                  </span>
                </span>

                <span className="hidden truncate text-[13px] text-text-muted lg:block">
                  {row.contact}
                </span>

                <span
                  className={`truncate text-right text-[13px] ${
                    row.tone === 'danger'
                      ? 'text-danger'
                      : row.tone === 'warning'
                        ? 'text-warning'
                        : 'text-text-secondary'
                  }`}
                >
                  {row.statusLabel}
                  {row.endsAtLabel ? ` · до ${row.endsAtLabel}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Никого не нашли</p>
      ) : null}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto lg:mx-auto lg:w-[640px] lg:max-w-[92vw] lg:rounded-t-sheet lg:border-x"
        >
          <SheetHeader>
            <SheetTitle>{selected?.name || 'Без имени'}</SheetTitle>
            <SheetDescription>
              {selected?.contact} · {selected?.statusLabel}
              {selected?.endsAtLabel ? ` до ${selected.endsAtLabel}` : ''}
            </SheetDescription>
          </SheetHeader>

          {selected ? (
            <div className="flex flex-col gap-4 px-4 pb-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="priceRub">Цена, ₽</Label>
                <Input
                  id="priceRub"
                  name="priceRub"
                  form="grant-months-form"
                  inputMode="numeric"
                  defaultValue={defaultPrice ?? ''}
                />
                <Label htmlFor="note">Заметка</Label>
                <Input
                  id="note"
                  name="note"
                  form="grant-months-form"
                  placeholder="Оплатил наличными"
                />
              </div>

              <form
                id="grant-months-form"
                action={grantMonthsAction}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="userId" value={selected.id} />
                <div className="flex gap-2">
                  {([1, 3] as const).map((months) => (
                    <Button key={months} type="submit" name="months" value={months} className="flex-1">
                      +{months} мес
                    </Button>
                  ))}
                </div>
                <Button type="submit" name="months" value={6} variant="secondary">
                  +6 мес
                </Button>
              </form>

              <form action={grantUntilAction} className="flex items-end gap-2">
                <input type="hidden" name="userId" value={selected.id} />
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="untilDate">До даты</Label>
                  <Input id="untilDate" name="untilDate" type="date" required />
                </div>
                <Button type="submit" variant="secondary">
                  Выдать
                </Button>
              </form>

              <div className="flex gap-2">
                {selected.isFrozen ? (
                  <form action={unfreezeAction} className="flex-1">
                    <input type="hidden" name="userId" value={selected.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                      Разморозить
                    </Button>
                  </form>
                ) : (
                  <form action={freezeAction} className="flex-1">
                    <input type="hidden" name="userId" value={selected.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                      Заморозить
                    </Button>
                  </form>
                )}

                <form action={disableAction} className="flex-1" id="disable-form">
                  <input type="hidden" name="userId" value={selected.id} />
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setConfirmDisable(true)}
                  >
                    Отключить
                  </Button>
                </form>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[13px] text-text-muted">История</p>
                {selected.history.length === 0 ? (
                  <p className="text-[15px] text-text-secondary">Пока пусто</p>
                ) : (
                  selected.history.map((event) => (
                    <p key={event.id} className="text-[15px] text-text-secondary">
                      {event.date} — {event.label}
                    </p>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отключить доступ?</DialogTitle>
            <DialogDescription>
              {selected?.name || 'Клиент'} потеряет доступ к тренировкам и МаксИИму. История сохранится.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisable(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDisable(false)
                const form = document.getElementById('disable-form')
                if (form instanceof HTMLFormElement) form.requestSubmit()
              }}
            >
              Отключить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
