'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure'
import { ExerciseListItemRow } from '@/components/exercise/exercise-list-item'
import type { FigureSide } from '@/components/muscle-figure/state'
import type { ExerciseListItem, Machine } from '@/modules/catalog'
import { MUSCLES, muscleName, type MuscleCode } from '@/shared/muscles'
import { exercisesLabel } from '@/shared/plural'

export { exercisesLabel }

type Props = {
  items: ExerciseListItem[]
  machines: Pick<Machine, 'id' | 'name'>[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}

/**
 * Каталог: фигура-фильтр по мышце, список мышц видимой стороны, поиск, чипы тренажёров,
 * список упражнений (DESIGN.md §8.1).
 */
export function CatalogClient({ items, machines }: Props) {
  const [muscle, setMuscle] = useState<MuscleCode | null>(null)
  const [side, setSide] = useState<FigureSide>('front')
  const [query, setQuery] = useState('')
  const [machineId, setMachineId] = useState<string | null>(null)
  const chips = useRef(new Map<string, HTMLButtonElement | null>())

  /** Поиск и тренажёр применяются сразу; по этому списку считаем счётчики у мышц. */
  const searched = useMemo(() => {
    const needle = normalize(query)

    return items.filter((item) => {
      if (machineId && item.machineId !== machineId) return false
      if (!needle) return true
      return normalize(`${item.name} ${item.machineName ?? ''}`).includes(needle)
    })
  }, [items, machineId, query])

  /** Сколько упражнений на каждую мышцу: счётчик виден до касания, «пустой» фильтр не выбирается. */
  const counts = useMemo(() => {
    const map = new Map<string, number>()

    for (const item of searched) {
      for (const code of new Set([...item.primaryMuscles, ...item.secondaryMuscles])) {
        map.set(code, (map.get(code) ?? 0) + 1)
      }
    }

    return map
  }, [searched])

  const visible = useMemo(() => {
    if (!muscle) return searched

    const filtered = searched.filter(
      (item) => item.primaryMuscles.includes(muscle) || item.secondaryMuscles.includes(muscle),
    )

    // Упражнения, где мышца основная, — сверху.
    return [...filtered].sort((a, b) => {
      const aPrimary = a.primaryMuscles.includes(muscle) ? 0 : 1
      const bPrimary = b.primaryMuscles.includes(muscle) ? 0 : 1
      return aPrimary - bPrimary
    })
  }, [searched, muscle])

  /** Мышцы видимой стороны фигуры — в справочнике они идут сверху вниз, как на фигуре. */
  const sideMuscles = useMemo(() => MUSCLES.filter((item) => item.view === side), [side])

  function toggleMuscle(code: MuscleCode): void {
    setMuscle((current) => (current === code ? null : code))
  }

  // Строка мышц прокручивается по горизонтали — держим выбранный чип в кадре.
  useEffect(() => {
    if (!muscle) return

    const chip = chips.current.get(muscle)
    if (typeof chip?.scrollIntoView === 'function') {
      chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [muscle, side])

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Упражнения</h1>

      <MuscleFigure
        view={side}
        onViewChange={setSide}
        primary={muscle ? [muscle] : []}
        secondary={[]}
        onMuscleTap={toggleMuscle}
        size="md"
      />

      <div className="flex flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          {muscle ? (
            <p className="text-[13px] text-text-muted">
              Фильтр: <span className="text-text-secondary">{muscleName(muscle)}</span> ·{' '}
              {exercisesLabel(counts.get(muscle) ?? 0)}
            </p>
          ) : (
            <p className="text-[13px] text-text-muted">
              Коснись мышцы на фигуре или выбери из списка
            </p>
          )}

          {muscle ? (
            <button
              type="button"
              onClick={() => setMuscle(null)}
              className="shrink-0 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[13px] text-text-secondary"
            >
              Сбросить
            </button>
          ) : null}
        </div>

        {/* Те же мышцы списком: попасть в чип проще, чем в тонкий контур на фигуре. */}
        <div role="group" aria-label="Мышцы" className="flex gap-2 scroll-row pb-1">
          <button
            type="button"
            onClick={() => setMuscle(null)}
            aria-pressed={muscle === null}
            className={`min-h-11 shrink-0 rounded-full border px-3.5 text-[13px] ${
              muscle === null
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Все мышцы
          </button>

          {sideMuscles.map((item) => {
            const count = counts.get(item.code) ?? 0
            const active = muscle === item.code

            return (
              <button
                key={item.code}
                type="button"
                ref={(node) => {
                  chips.current.set(item.code, node)
                }}
                onClick={() => toggleMuscle(item.code)}
                // Мышц без упражнений в списке нет — чип не уводит в пустой экран.
                disabled={count === 0 && !active}
                aria-pressed={active}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${
                  active
                    ? 'border-accent bg-surface-2 text-text'
                    : count === 0
                      ? 'border-border bg-surface-1 text-text-muted opacity-60'
                      : 'border-border bg-surface-1 text-text-secondary'
                }`}
              >
                {item.nameRu}
                <span className="tabular-nums text-text-muted">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти упражнение"
        className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
      />

      {machines.length > 0 ? (
        <div className="flex gap-2 scroll-row pb-1">
          <button
            type="button"
            onClick={() => setMachineId(null)}
            className={`min-h-11 shrink-0 rounded-full border px-3.5 text-[13px] ${
              machineId === null
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Все тренажёры
          </button>
          {machines.map((machine) => (
            <button
              key={machine.id}
              type="button"
              onClick={() => setMachineId(machine.id === machineId ? null : machine.id)}
              className={`min-h-11 shrink-0 rounded-full border px-3.5 text-[13px] ${
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
