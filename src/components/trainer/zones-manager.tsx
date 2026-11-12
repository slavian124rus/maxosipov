'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { machinesLabel } from '@/shared/plural'
import {
  createZoneAction,
  deleteZoneAction,
  renameZoneAction,
  type ZoneState,
} from '@/app/(app)/app/trainer/settings/zones/actions'

const INITIAL: ZoneState = { error: null, saved: false }

export type ZoneRow = { id: string; name: string; machineCount: number }

/**
 * Зоны тренажёров (DESIGN.md §8.9): добавить, переименовать, удалить пустую.
 * Переименование меняет зону и у тренажёров — дерево в кабинете остаётся в порядке.
 */
export function ZonesManager({ zones }: { zones: ZoneRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <AddZone />

      {zones.length === 0 ? (
        <p className="text-[15px] text-text-secondary">
          Зон пока нет — добавь первую, например «Кардио»
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zones.map((zone) => (
            <ZoneItem key={zone.id} zone={zone} />
          ))}
        </ul>
      )}

      <p className="text-[13px] text-text-muted">
        Зоны приходят из тренажёров: если в карточке тренажёра стоит зона «Спина», она уже в этом
        списке — добавлять её вручную не нужно. Новую зону добавь полем выше или впиши в карточке
        тренажёра, и она появится здесь сама. По этим зонам строится дерево в «Упражнениях» и
        «Тренажёрах».
      </p>
    </div>
  )
}

/** Добавление зоны: поле и кнопка, без модальных окон. */
function AddZone() {
  const [state, formAction, pending] = useActionState(createZoneAction, INITIAL)

  useEffect(() => {
    if (state.saved) toast.success('Зона добавлена')
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <form action={formAction} className="flex gap-2">
      <Input
        name="name"
        placeholder="Название зоны, например Кардио"
        aria-label="Название новой зоны"
        required
        minLength={2}
        maxLength={60}
        className="h-12"
      />
      <Button type="submit" disabled={pending} className="h-12 shrink-0">
        {pending ? 'Добавляем…' : 'Добавить'}
      </Button>
    </form>
  )
}

/** Одна зона: название, число тренажёров, переименование и удаление. */
function ZoneItem({ zone }: { zone: ZoneRow }) {
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-3">
      {renaming ? (
        <RenameZoneForm zone={zone} onDone={() => setRenaming(false)} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] text-text">{zone.name}</span>
            <span className="tabular-nums text-[13px] text-text-muted">
              {zone.machineCount > 0 ? machinesLabel(zone.machineCount) : 'тренажёров пока нет'}
            </span>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-10"
              onClick={() => setRenaming(true)}
            >
              <Pencil size={15} strokeWidth={1.75} aria-hidden />
              Переименовать
            </Button>

            <DeleteZone zone={zone} open={confirming} onOpenChange={setConfirming} />
          </div>
        </div>
      )}
    </li>
  )
}

/** Переименование на месте: поле и «Сохранить»; после успеха возвращаемся к списку. */
function RenameZoneForm({ zone, onDone }: { zone: ZoneRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(renameZoneAction, INITIAL)

  useEffect(() => {
    if (state.saved) {
      toast.success('Зона переименована', { description: 'Тренажёры переехали вместе с ней' })
      onDone()
    }
    if (state.error) toast.error(state.error)
  }, [state, onDone])

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={zone.id} />
      <Input
        name="name"
        defaultValue={zone.name}
        aria-label={`Новое название зоны «${zone.name}»`}
        autoFocus
        required
        minLength={2}
        maxLength={60}
        className="h-11 min-w-[180px] flex-1"
      />
      <Button type="submit" disabled={pending} className="h-11">
        <Check size={16} strokeWidth={2} aria-hidden />
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </Button>
      <Button type="button" variant="ghost" className="h-11" onClick={onDone}>
        <X size={16} strokeWidth={2} aria-hidden />
        Отмена
      </Button>
    </form>
  )
}

/** Удаление зоны: только пустой, иначе кнопка неактивна и объясняет почему. */
function DeleteZone({
  zone,
  open,
  onOpenChange,
}: {
  zone: ZoneRow
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const [state, formAction, pending] = useActionState(deleteZoneAction, INITIAL)
  const blocked = zone.machineCount > 0

  useEffect(() => {
    if (state.saved) {
      toast.success('Зона удалена', { description: zone.name })
      onOpenChange(false)
    }
    if (state.error) toast.error(state.error)
  }, [state, zone.name, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="destructive"
        className="min-h-10"
        disabled={blocked}
        title={blocked ? 'Сначала перенеси тренажёры в другую зону' : undefined}
        onClick={() => onOpenChange(true)}
      >
        Удалить
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить зону «{zone.name}»?</DialogTitle>
          <DialogDescription>
            Зона исчезнет из списков. Тренажёров в ней нет, поэтому каталог не изменится.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="id" value={zone.id} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Удаляем…' : 'Удалить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
