'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type SwapOption = { id: string; name: string; machineName: string | null }
export type SwapMode = 'today' | 'forever'

/**
 * Окно «Занято? Заменить». Сначала клиент выбирает упражнение из списка тренера,
 * потом отвечает на вопрос: только сегодня или насовсем (каждый раз спрашиваем).
 */
export function SwapSheet({
  exerciseName,
  options,
  lockedReason = null,
  onClose,
  onPick,
}: {
  exerciseName: string
  options: SwapOption[]
  /** Заменить сейчас нельзя (уже есть подходы или нет сети): список только для просмотра. */
  lockedReason?: string | null
  onClose: () => void
  /** Возвращает текст ошибки или `null`, если замена прошла. */
  onPick: (option: SwapOption, mode: SwapMode) => Promise<string | null>
}) {
  const [chosen, setChosen] = useState<SwapOption | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(mode: SwapMode): Promise<void> {
    if (!chosen) return
    setBusy(true)
    setError(null)
    const result = await onPick(chosen, mode)
    setBusy(false)
    if (result) setError(result)
    else onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{chosen ? chosen.name : 'Чем заменить?'}</DialogTitle>
          <DialogDescription>
            {chosen
              ? `Вместо «${exerciseName}». Заменить только на эту тренировку или оставить в программе?`
              : lockedReason
                ? `${lockedReason}. Вот чем тренер разрешил заменить «${exerciseName}»`
                : `Тренажёр для «${exerciseName}» занят — вот что подходит по мышцам`}
          </DialogDescription>
        </DialogHeader>

        {chosen ? (
          <div className="flex flex-col gap-2">
            <Button type="button" disabled={busy} onClick={() => void pick('today')}>
              Только сегодня
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void pick('forever')}>
              Заменить насовсем
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setChosen(null)}>
              Выбрать другое
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const content = (
                <>
                  <span className="text-[15px]">{option.name}</span>
                  {option.machineName ? (
                    <span className="text-[13px] text-text-muted">{option.machineName}</span>
                  ) : null}
                </>
              )
              const base =
                'flex min-h-14 flex-col justify-center rounded-control border border-border bg-surface-1 px-3 py-2 text-left'

              return lockedReason ? (
                <div key={option.id} className={base}>
                  {content}
                </div>
              ) : (
                <button key={option.id} type="button" onClick={() => setChosen(option)} className={base}>
                  {content}
                </button>
              )
            })}
          </div>
        )}

        {error ? <p className="text-[13px] text-warning">{error}</p> : null}
      </DialogContent>
    </Dialog>
  )
}
