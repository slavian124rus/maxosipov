'use client'

import { useMemo, useState } from 'react'
import { MachineTree } from '@/components/trainer/machine-tree'
import { MachineForm } from '@/components/trainer/machine-form'
import { PageHeader } from '@/components/trainer/page'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { MachineListItem } from '@/modules/catalog'

type Props = {
  machines: MachineListItem[]
  /** Опубликованных упражнений на каждом тренажёре — подпись «N в каталоге». */
  counts: Record<string, number>
  /** Все упражнения (с черновиками и архивными) — по ним решается, можно ли удалить. */
  exerciseTotals: Record<string, number>
}

/**
 * Экран «Тренажёры» (DESIGN.md §8.9): дерево зона → тренажёр и лист снизу,
 * в котором тренажёр создаётся или правится (название, зона, шаг веса, фото).
 */
export function MachinesClient({ machines, counts, exerciseTotals }: Props) {
  const [editing, setEditing] = useState<MachineListItem | null>(null)
  const [creating, setCreating] = useState(false)

  const treeItems = useMemo(
    () =>
      machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        zone: machine.zone,
        weightStepKg: machine.weightStepKg,
        exerciseCount: counts[machine.id] ?? 0,
        thumbUrl: machine.thumbUrl,
        photoStatus: machine.photoStatus,
      })),
    [machines, counts],
  )

  /** Зоны зала — подсказки в форме, чтобы не плодить «Спина» и «спина». */
  const zones = useMemo(() => {
    const unique = new Set<string>()
    for (const machine of machines) {
      const zone = machine.zone?.trim()
      if (zone) unique.add(zone)
    }
    return [...unique].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [machines])

  const open = creating || editing !== null

  function close(): void {
    setCreating(false)
    setEditing(null)
  }

  function startCreate(): void {
    setEditing(null)
    setCreating(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Тренажёры"
        description="Фото, зона и шаг веса — то, что видит клиент в карточке упражнения"
        actions={
          <button
            type="button"
            onClick={startCreate}
            className="flex min-h-11 items-center rounded-control bg-accent px-4 text-[15px] text-white hover:bg-accent-pressed"
          >
            Добавить тренажёр
          </button>
        }
      />

      <MachineTree
        machines={treeItems}
        onEdit={(id) => setEditing(machines.find((m) => m.id === id) ?? null)}
      />

      <Sheet open={open} onOpenChange={(next) => (next ? undefined : close())}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto lg:mx-auto lg:w-[640px] lg:max-w-[92vw] lg:rounded-t-sheet lg:border-x"
        >
          <SheetHeader>
            <SheetTitle>{editing ? editing.name : 'Новый тренажёр'}</SheetTitle>
            <SheetDescription>
              {editing
                ? 'Измени название, зону, шаг веса или замени фото'
                : 'Название, зона, шаг веса и фото тренажёра'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            <MachineForm
              key={editing?.id ?? 'new'}
              machine={editing}
              zones={zones}
              exerciseCount={editing ? (exerciseTotals[editing.id] ?? 0) : 0}
              onSaved={close}
              onDeleted={close}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
