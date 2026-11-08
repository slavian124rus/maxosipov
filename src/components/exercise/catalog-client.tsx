'use client'

import { useMemo, useState } from 'react'
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure'
import { ExerciseListItemRow } from '@/components/exercise/exercise-list-item'
import type { ExerciseListItem, Machine } from '@/modules/catalog'
import type { MuscleCode } from '@/shared/muscles'

type Props = {
  items: ExerciseListItem[]
  machines: Pick<Machine, 'id' | 'name'>[]
}

/** Каталог: фигура-фильтр по мышце, поиск, чипы тренажёров, список упражнений. */
export function CatalogClient({ items, machines }: Props) {
  const [muscle, setMuscle] = useState<MuscleCode | null>(null)
  const [query, setQuery] = useState('')
  const [machineId, setMachineId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/ё/g, 'е')

    const filtered = items.filter((item) => {
      if (machineId && item.machineName === null) return false
      if (muscle) {
        const inPrimary = item.primaryMuscles.includes(muscle)
        const inSecondary = item.secondaryMuscles.includes(muscle)
        if (!inPrimary && !inSecondary) return false
      }
      if (normalized) {
        const haystack = `${item.name} ${item.machineName ?? ''}`.toLowerCase().replace(/ё/g, 'е')
        if (!haystack.includes(normalized)) return false
      }
      return true
    })

    if (!muscle) return filtered

    return [...filtered].sort((a, b) => {
      const aPrimary = a.primaryMuscles.includes(muscle) ? 0 : 1
      const bPrimary = b.primaryMuscles.includes(muscle) ? 0 : 1
      return aPrimary - bPrimary
    })
  }, [items, machineId, muscle, query])

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Упражнения</h1>

      <MuscleFigure
        primary={muscle ? [muscle] : []}
        secondary={[]}
        onMuscleTap={(code) => setMuscle((current) => (current === code ? null : code))}
        size="md"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMuscle(null)}
          className={`rounded-full border px-3 py-1.5 text-[13px] ${
            muscle ? 'border-border bg-surface-1 text-text-secondary' : 'border-accent bg-surface-2 text-text'
          }`}
        >
          Все мышцы
        </button>
        {muscle ? (
          <span className="text-[13px] text-text-muted">Фильтр: {muscle}</span>
        ) : null}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти упражнение"
        className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
      />

      {machines.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMachineId(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
              machineId === null ? 'border-accent bg-surface-2 text-text' : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Все тренажёры
          </button>
          {machines.map((machine) => (
            <button
              key={machine.id}
              type="button"
              onClick={() => setMachineId(machine.id === machineId ? null : machine.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                machineId === machine.id
                  ? 'border-accent bg-surface-2 text-text'
                  : 'border-border bg-surface-1 text-text-secondary'
              }`}
            >
              {machine.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {visible.map((item) => (
          <ExerciseListItemRow key={item.id} item={item} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-[15px] text-text-secondary">
          Таких упражнений пока нет — Максим добавляет новые каждую неделю
        </p>
      ) : null}
    </div>
  )
}
