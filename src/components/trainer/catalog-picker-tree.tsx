'use client'

import { useMemo, useState } from 'react'
import { Check, Dumbbell } from 'lucide-react'
import {
  buildExerciseTree,
  filterExerciseTree,
  NO_MACHINE_KEY,
  type ExerciseTreeItem,
} from '@/components/trainer/catalog-tree'
import {
  BranchChevron,
  BranchCount,
  Highlight,
  TreeSearchField,
} from '@/components/trainer/tree-ui'

export type PickerItem = {
  id: string
  name: string
  machineId?: string | null
  machineName: string | null
  machineZone?: string | null
}

/**
 * Дерево выбора упражнения: зона → тренажёр → упражнение, с поиском и сворачиванием,
 * как в каталоге тренера. Касание упражнения вызывает `onPick`; уже выбранные отмечены галочкой.
 */
export function CatalogPickerTree({
  items,
  chosenIds,
  onPick,
}: {
  items: PickerItem[]
  chosenIds: ReadonlySet<string>
  onPick: (item: PickerItem) => void
}) {
  const [query, setQuery] = useState('')
  const [closedZones, setClosedZones] = useState<ReadonlySet<string>>(() => new Set())
  const [openMachines, setOpenMachines] = useState<ReadonlySet<string>>(() => new Set())

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const zones = useMemo(() => {
    const treeItems: ExerciseTreeItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      status: 'published',
      machineId: item.machineId ?? (item.machineName ? item.machineName : null),
      machineName: item.machineName,
      machineZone: item.machineZone ?? null,
      muscles: [],
      videoLabel: '',
      hasMuscles: false,
    }))
    return filterExerciseTree(buildExerciseTree(treeItems), query)
  }, [items, query])

  const searching = query.trim().length > 0

  function toggle(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  function renderExercise(exercise: ExerciseTreeItem) {
    const chosen = chosenIds.has(exercise.id)

    return (
      <li key={exercise.id}>
        <button
          type="button"
          disabled={chosen}
          onClick={() => {
            const item = byId.get(exercise.id)
            if (item) onPick(item)
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left text-[15px] hover:bg-surface-2 disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate">
            <Highlight text={exercise.name} query={query} />
          </span>
          {chosen ? <Check size={16} aria-label="Уже в списке" className="text-success" /> : null}
        </button>
      </li>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TreeSearchField
        value={query}
        onChange={setQuery}
        placeholder="Упражнение, тренажёр или зона"
        label="Поиск упражнения"
      />

      {zones.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Ничего не нашлось</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {zones.map((zone) => {
            const zoneOpen = searching || !closedZones.has(zone.key)

            return (
              <li key={zone.key}>
                <button
                  type="button"
                  onClick={() => setClosedZones((current) => toggle(current, zone.key))}
                  aria-expanded={zoneOpen}
                  className="flex w-full items-center gap-2 rounded-card border border-border bg-surface-1 px-3 py-3 text-left"
                >
                  <BranchChevron open={zoneOpen} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    <Highlight text={zone.title} query={query} />
                  </span>
                  <BranchCount count={zone.count} />
                </button>

                {zoneOpen ? (
                  <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-border pl-3">
                    {zone.key === NO_MACHINE_KEY
                      ? // В ветке «Без тренажёра» уровень тренажёра не рисуем, как в каталоге тренера.
                        zone.machines
                          .flatMap((machine) => machine.exercises)
                          .map((exercise) => renderExercise(exercise))
                      : zone.machines.map((machine) => {
                          const machineOpen = searching || openMachines.has(machine.key)

                          return (
                            <li key={machine.key}>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMachines((current) => toggle(current, machine.key))
                                }
                                aria-expanded={machineOpen}
                                className="flex w-full items-center gap-2 rounded-control bg-surface-1 px-3 py-2.5 text-left"
                              >
                                <BranchChevron open={machineOpen} />
                                <Dumbbell
                                  size={16}
                                  strokeWidth={1.75}
                                  aria-hidden
                                  className="shrink-0 text-text-muted"
                                />
                                <span className="min-w-0 flex-1 truncate text-[15px]">
                                  <Highlight text={machine.title} query={query} />
                                </span>
                                <BranchCount count={machine.exercises.length} />
                              </button>

                              {machineOpen ? (
                                <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-border pl-3">
                                  {machine.exercises.map((exercise) => renderExercise(exercise))}
                                </ul>
                              ) : null}
                            </li>
                          )
                        })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
