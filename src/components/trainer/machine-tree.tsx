'use client'

import { useMemo, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import {
  buildMachineTree,
  filterMachineTree,
  type MachineTreeItem,
} from '@/components/trainer/catalog-tree'
import { BranchChevron, BranchCount, Highlight, TreeSearchField } from '@/components/trainer/tree-ui'

/** Шаг веса по DESIGN §9.2 — с запятой: «2,5 кг». */
function weightLabel(value: number): string {
  return `${String(value).replace('.', ',')} кг`
}

/** Тренажёры зала деревом: зона → тренажёр, с поиском и числом упражнений. */
export function MachineTree({ machines }: { machines: MachineTreeItem[] }) {
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())

  const zones = useMemo(
    () => filterMachineTree(buildMachineTree(machines), query),
    [machines, query],
  )

  const searching = query.trim().length > 0
  const found = zones.reduce((sum, zone) => sum + zone.machines.length, 0)

  // Во время поиска зоны раскрыты — иначе совпадений не видно.
  const isOpen = (key: string): boolean => searching || !closed.has(key)

  function toggle(key: string): void {
    setClosed((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <TreeSearchField
        value={query}
        onChange={setQuery}
        placeholder="Тренажёр или зона"
        label="Поиск по тренажёрам"
      />

      <p className="tabular-nums text-[13px] text-text-muted">
        {searching ? `Найдено тренажёров: ${found}` : `Всего тренажёров: ${machines.length}`}
      </p>

      {zones.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {zones.map((zone) => {
            const open = isOpen(zone.key)

            return (
              <li key={zone.key}>
                <button
                  type="button"
                  onClick={() => toggle(zone.key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 rounded-card border border-border bg-surface-1 px-3 py-3 text-left"
                >
                  <BranchChevron open={open} />
                  <span className="text-[17px]">
                    <Highlight text={zone.title} query={query} />
                  </span>
                  <BranchCount count={zone.machines.length} />
                </button>

                {open ? (
                  <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-border pl-3">
                    {zone.machines.map((machine) => (
                      <li
                        key={machine.id}
                        className="flex items-center gap-2 rounded-control bg-surface-1 px-3 py-2.5"
                      >
                        <Dumbbell
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                          className="shrink-0 text-text-muted"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[15px]">
                            <Highlight text={machine.name} query={query} />
                          </span>
                          <span className="tabular-nums text-[13px] text-text-muted">
                            {`шаг ${weightLabel(machine.weightStepKg)}${
                              machine.exerciseCount > 0
                                ? ` · ${machine.exerciseCount} в каталоге`
                                : ' · в каталоге пока нет'
                            }`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {zones.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-text-secondary">
            {searching
              ? `По запросу «${query.trim()}» тренажёров не нашлось`
              : 'Пока ни одного тренажёра'}
          </p>
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="min-h-11 w-fit rounded-full border border-border px-4 text-[13px] text-text-secondary"
            >
              Показать все
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
