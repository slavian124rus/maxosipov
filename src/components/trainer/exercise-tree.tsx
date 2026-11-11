'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import {
  buildExerciseTree,
  countTreeExercises,
  filterExerciseTree,
  NO_MACHINE_KEY,
  type ExerciseTreeItem,
  type MachineBranch,
} from '@/components/trainer/catalog-tree'
import { BranchChevron, BranchCount, Highlight, TreeSearchField, TreeTableHead } from '@/components/trainer/tree-ui'
import { exercisesLabel } from '@/shared/plural'

export type ExerciseTab = 'published' | 'draft'

const TABS = [
  { value: 'published', label: 'Опубликованы', empty: 'Опубликованных упражнений нет' },
  { value: 'draft', label: 'Черновики', empty: 'Черновиков нет' },
] as const satisfies { value: ExerciseTab; label: string; empty: string }[]

type Props = {
  items: ExerciseTreeItem[]
  initialTab: ExerciseTab
}

/**
 * Каталог тренера: вкладки «Опубликованы / Черновики», поиск и дерево
 * зона → тренажёр → упражнение (DESIGN.md §8.9).
 */
export function ExerciseTree({ items, initialTab }: Props) {
  const [tab, setTab] = useState<ExerciseTab>(initialTab)
  const [query, setQuery] = useState('')
  const [closedZones, setClosedZones] = useState<ReadonlySet<string>>(() => new Set())
  const [openMachines, setOpenMachines] = useState<ReadonlySet<string>>(() => new Set())

  // Вкладку держим в адресе без перехода на сервер: ссылка ?tab=draft продолжает работать,
  // а переключение не сбрасывает введённый поисковый запрос.
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    const url = new URL(window.location.href)
    if (url.searchParams.get('tab') !== tab) {
      url.searchParams.set('tab', tab)
      window.history.replaceState(null, '', url)
    }
  }, [tab])

  useEffect(() => {
    function onPopState(): void {
      const next = new URL(window.location.href).searchParams.get('tab')
      setTab(next === 'draft' ? 'draft' : 'published')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const byTab = useMemo(() => {
    const map: Record<ExerciseTab, ExerciseTreeItem[]> = { published: [], draft: [] }
    for (const item of items) map[item.status].push(item)
    return map
  }, [items])

  const zones = useMemo(
    () => filterExerciseTree(buildExerciseTree(byTab[tab]), query),
    [byTab, query, tab],
  )

  const searching = query.trim().length > 0
  const found = countTreeExercises(zones)
  const allMachineKeys = useMemo(
    () => zones.flatMap((zone) => zone.machines.map((machine) => machine.key)),
    [zones],
  )

  // Пока идёт поиск, дерево раскрыто целиком — иначе совпадения не увидеть.
  const zoneOpen = (key: string): boolean => searching || !closedZones.has(key)
  const machineOpen = (key: string): boolean => searching || openMachines.has(key)

  function toggleZone(key: string): void {
    setClosedZones((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleMachine(key: string): void {
    setOpenMachines((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll(): void {
    setClosedZones(new Set())
    setOpenMachines(new Set(allMachineKeys))
  }

  function collapseAll(): void {
    setClosedZones(new Set(zones.map((zone) => zone.key)))
    setOpenMachines(new Set())
  }

  const activeTab = TABS.find((option) => option.value === tab) ?? TABS[0]
  const emptyText = searching ? null : activeTab.empty

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Статус упражнений" className="flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            aria-pressed={tab === option.value}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] ${
              tab === option.value
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            {option.label}
            <span className="tabular-nums text-text-muted">{byTab[option.value].length}</span>
          </button>
        ))}
      </div>

      <TreeSearchField
        value={query}
        onChange={setQuery}
        placeholder="Упражнение, тренажёр, зона или мышца"
        label="Поиск по упражнениям"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="tabular-nums text-[13px] text-text-muted">
          {searching ? `Найдено: ${found}` : `${activeTab.label}: ${byTab[tab].length}`}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            disabled={zones.length === 0}
            className="min-h-9 rounded-full border border-border px-3 text-[13px] text-text-secondary disabled:opacity-50"
          >
            Развернуть
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={zones.length === 0}
            className="min-h-9 rounded-full border border-border px-3 text-[13px] text-text-secondary disabled:opacity-50"
          >
            Свернуть
          </button>
        </div>
      </div>

      {zones.length > 0 ? (
        <div className="lg:rounded-card lg:border lg:border-border lg:bg-surface-1">
          <TreeTableHead first="Зона, тренажёр, упражнение" second="Видео" third="Мышцы" />

          <ul className="flex flex-col gap-2 lg:gap-0 lg:p-1">
            {zones.map((zone) => {
              const open = zoneOpen(zone.key)

              return (
                <li key={zone.key}>
                  <button
                    type="button"
                    onClick={() => toggleZone(zone.key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-card border border-border bg-surface-1 px-3 py-3 text-left hover:bg-surface-2/40 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_150px] lg:items-center lg:gap-3 lg:rounded-control lg:border-0 lg:px-3 lg:py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <BranchChevron open={open} />
                      <span className="truncate text-[17px] lg:text-[15px]">
                        <Highlight text={zone.title} query={query} />
                      </span>
                    </span>
                    <span className="hidden tabular-nums text-[13px] text-text-muted lg:block">
                      {exercisesLabel(zone.count)}
                    </span>
                    <span className="hidden lg:block" />
                    <BranchCount count={zone.count} className="lg:hidden" />
                  </button>

                  {open ? (
                    <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-border pl-3 lg:mt-0 lg:mb-1 lg:ml-4 lg:gap-0.5">
                      {zone.machines.map((machine) => (
                        <MachineNode
                          key={machine.key}
                          machine={machine}
                          query={query}
                          open={machineOpen(machine.key)}
                          onToggle={() => toggleMachine(machine.key)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {zones.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-text-secondary">
            {searching ? `По запросу «${query.trim()}» ничего не нашлось` : emptyText}
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

/** Ветка тренажёра; в ветке «Без тренажёра» уровень тренажёра не рисуем. */
function MachineNode({
  machine,
  query,
  open,
  onToggle,
}: {
  machine: MachineBranch
  query: string
  open: boolean
  onToggle: () => void
}) {
  if (machine.key === NO_MACHINE_KEY) {
    return (
      <li className="flex flex-col gap-1 py-1">
        {machine.exercises.map((item) => (
          <ExerciseRow key={item.id} item={item} query={query} />
        ))}
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-control bg-surface-1 px-3 py-2.5 text-left hover:bg-surface-2/40 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_150px] lg:items-center lg:gap-3 lg:px-3 lg:py-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BranchChevron open={open} />
          <Dumbbell
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="shrink-0 text-text-muted"
          />
          <span className="truncate text-[15px]">
            <Highlight text={machine.title} query={query} />
          </span>
        </span>
        <span className="hidden tabular-nums text-[13px] text-text-muted lg:block">
          {exercisesLabel(machine.exercises.length)}
        </span>
        <span className="hidden lg:block" />
        <BranchCount count={machine.exercises.length} className="lg:hidden" />
      </button>

      {open ? (
        <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-border pl-3 lg:mt-0 lg:gap-0.5">
          {machine.exercises.map((item) => (
            <li key={item.id}>
              <ExerciseRow item={item} query={query} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Строка упражнения — ссылка на карточку в кабинете. */
function ExerciseRow({ item, query }: { item: ExerciseTreeItem; query: string }) {
  return (
    <Link
      href={`/trainer/exercises/${item.id}`}
      className="flex flex-col gap-0.5 rounded-control border border-border bg-surface-1 px-3 py-2.5 hover:bg-surface-2/40 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_150px] lg:items-center lg:gap-3 lg:rounded-none lg:border-0 lg:border-b lg:border-border/50 lg:px-3 lg:py-2"
    >
      <span className="truncate text-[15px] text-text">
        <Highlight text={item.name} query={query} />
      </span>
      <span className="truncate text-[13px] text-text-muted">{item.videoLabel}</span>
      <span>
        {item.hasMuscles ? (
          <span className="w-fit rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-gold">
            Мышцы на видео
          </span>
        ) : null}
      </span>
    </Link>
  )
}
