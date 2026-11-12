'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { groupMachinesByZone, normalizeQuery } from '@/components/trainer/catalog-tree'
import { exercisesLabel } from '@/shared/plural'
import type { CatalogItem } from './program-editor'

/** Шаг «− значение +»: один тап — одно изменение (DESIGN.md §8.9). */
export function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const clamp = (next: number): number => Math.min(max, Math.max(min, next))

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[15px] text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} меньше`}
          onClick={() => onChange(clamp(value - step))}
          className="h-11 w-11 rounded-control bg-surface-2 text-[20px] text-text"
        >
          −
        </button>
        <span className="w-12 text-center font-display text-[20px] text-text">{value}</span>
        <button
          type="button"
          aria-label={`${label} больше`}
          onClick={() => onChange(clamp(value + step))}
          className="h-11 w-11 rounded-control bg-surface-2 text-[20px] text-text"
        >
          +
        </button>
      </div>
    </div>
  )
}

/** Каталог с поиском и чипами зон — общий для «добавить» и «заменить». */
function CatalogPicker({
  catalog,
  onPick,
  disabledId,
  emptyHint = 'Ничего не нашлось',
}: {
  catalog: CatalogItem[]
  onPick: (exerciseId: string) => void
  disabledId?: string
  emptyHint?: string
}) {
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState<string | null>(null)

  const zones = useMemo(() => {
    const unique = new Set<string>()
    for (const item of catalog) if (item.zone) unique.add(item.zone)
    return [...unique].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [catalog])

  const groups = useMemo(() => {
    const needle = normalizeQuery(query)
    const visible = catalog.filter((item) => {
      if (zone && item.zone !== zone) return false
      if (!needle) return true
      return (
        normalizeQuery(item.name).includes(needle) ||
        normalizeQuery(item.machineName ?? '').includes(needle) ||
        normalizeQuery(item.zone ?? '').includes(needle)
      )
    })

    return groupMachinesByZone(visible)
  }, [catalog, query, zone])

  const total = groups.reduce((sum, group) => sum + group.machines.length, 0)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск: упражнение, тренажёр или зона"
        aria-label="Поиск упражнения"
        className="h-11 w-full min-w-0 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
      />

      {zones.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setZone(null)}
            aria-pressed={zone === null}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-[13px] ${
              zone === null
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Все зоны
          </button>
          {zones.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setZone(item === zone ? null : item)}
              aria-pressed={zone === item}
              className={`min-h-10 shrink-0 rounded-full border px-3 text-[13px] ${
                zone === item
                  ? 'border-accent bg-surface-2 text-text'
                  : 'border-border bg-surface-1 text-text-secondary'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <p className="tabular-nums text-[13px] text-text-muted">
        {total > 0 ? exercisesLabel(total) : emptyHint}
      </p>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">{group.title}</p>
            {group.machines.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.id === disabledId}
                onClick={() => onPick(item.id)}
                className="min-h-11 rounded-control px-2 text-left text-[15px] text-text hover:bg-surface-2 disabled:opacity-40"
              >
                {item.name}
                <span className="block text-[13px] text-text-muted">
                  {item.machineName ?? 'Свободные веса'}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Добавление упражнения из каталога зала: поиск и фильтр по зонам. */
export function AddExercise({
  catalog,
  onAdd,
}: {
  catalog: CatalogItem[]
  onAdd: (exerciseId: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
        {open ? 'Скрыть каталог' : 'Добавить упражнение'}
      </Button>

      {open ? (
        <div className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3">
          <CatalogPicker
            catalog={catalog}
            onPick={(exerciseId) => {
              setOpen(false)
              onAdd(exerciseId)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

/** Список каталога для замены: сверху — та же мышца и тот же тренажёр, с зонами. */
export function ReplaceList({
  catalog,
  currentExerciseId,
  onPick,
}: {
  catalog: CatalogItem[]
  currentExerciseId: string
  onPick: (exerciseId: string) => void
}) {
  const currentItem = catalog.find((item) => item.id === currentExerciseId)
  const muscles = currentItem?.primary ?? []

  const sorted = [...catalog].sort((a, b) => {
    const score = (item: CatalogItem): number => {
      const sameMuscle = item.primary.some((code) => muscles.includes(code)) ? 2 : 0
      const sameMachine = item.machineName && item.machineName === currentItem?.machineName ? 1 : 0
      return sameMuscle + sameMachine
    }
    return score(b) - score(a)
  })

  return <CatalogPicker catalog={sorted} onPick={onPick} disabledId={currentExerciseId} />
}
