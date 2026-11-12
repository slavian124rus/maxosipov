'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  archiveExerciseAction,
  type ArchiveExerciseState,
} from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: ArchiveExerciseState = { error: null, archived: false }

/**
 * Удаление упражнения из каталога (CLAUDE.md, правило 6): запись уходит в архив,
 * история подходов клиентов остаётся. Поэтому в подтверждении так и написано.
 */
export function DeleteExercise({
  exerciseId,
  name,
  onDeleted,
}: {
  exerciseId: string
  name: string
  onDeleted?: () => void
}) {
  const [state, formAction, pending] = useActionState(archiveExerciseAction, INITIAL)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!state.archived) return
    toast.success('Упражнение удалено', { description: `${name} больше нет в каталоге` })
    onDeleted?.()
  }, [state, name, onDeleted])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[15px] text-text">Удалить упражнение</p>
        <p className="text-[13px] text-text-muted">
          Из каталога пропадёт, история подходов клиентов останется
        </p>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="shrink-0"
        >
          Удалить
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить «{name}»?</DialogTitle>
            <DialogDescription>
              Упражнение исчезнет из каталога и из программ. Записанные подходы и веса останутся
              в истории клиентов.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            <input type="hidden" name="id" value={exerciseId} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? 'Удаляем…' : 'Удалить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
