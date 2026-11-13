'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AddExercise,
  ReplaceList,
  Stepper,
} from '@/components/trainer/program-editor/editor-scheme'
import type { CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { patchMyPlanAction } from '@/app/(app)/app/(client)/plan/actions'
import { formatDuration, formatScheme } from '@/shared/scheme'
import type { ProgramPatch } from '@/modules/training'

export type PlanExercise = {
  id: string
  exerciseId: string
  name: string
  machineName: string | null
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

export type PlanDay = { id: string; name: string; minutes: number; exercises: PlanExercise[] }
export type PlanChange = { id: string; who: string; at: string; lines: string[] }

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Krasnoyarsk',
})

function ExerciseRow({
  item,
  index,
  count,
  catalog,
  busy,
  onPatch,
  onMove,
}: {
  item: PlanExercise
  index: number
  count: number
  catalog: CatalogItem[]
  busy: boolean
  onPatch: (patch: ProgramPatch) => void
  onMove: (delta: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState(item.sets)
  const [repMin, setRepMin] = useState(item.repMin)
  const [repMax, setRepMax] = useState(item.repMax)
  const [restSec, setRestSec] = useState(item.restSec)
  const [replacing, setReplacing] = useState(false)
  const [removing, setRemoving] = useState(false)

  const changed =
    sets !== item.sets ||
    repMin !== item.repMin ||
    repMax !== item.repMax ||
    restSec !== item.restSec

  return (
    <li className="flex flex-col gap-3 rounded-control border border-border bg-surface-1 px-3 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 items-center gap-2 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px]">{item.name}</span>
          <span className="text-[13px] text-text-muted">
            {formatScheme(item.sets, item.repMin, item.repMax, item.restSec)}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-3">
          <Stepper label="Подходы" value={sets} min={1} max={10} step={1} onChange={setSets} />
          <Stepper
            label="Повторений от"
            value={repMin}
            min={1}
            max={100}
            step={1}
            onChange={(value) => {
              setRepMin(value)
              if (value > repMax) setRepMax(value)
            }}
          />
          <Stepper
            label="Повторений до"
            value={repMax}
            min={1}
            max={100}
            step={1}
            onChange={(value) => {
              setRepMax(value)
              if (value < repMin) setRepMin(value)
            }}
          />
          <Stepper
            label="Отдых, сек"
            value={restSec}
            min={0}
            max={300}
            step={15}
            onChange={setRestSec}
          />

          <Button
            type="button"
            disabled={!changed || busy}
            onClick={() =>
              onPatch({
                ops: [
                  {
                    op: 'set_sets_reps',
                    programExerciseId: item.id,
                    sets,
                    repMin,
                    repMax,
                    restSec,
                  },
                ],
              })
            }
          >
            Сохранить
          </Button>

          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Выше"
              disabled={index === 0 || busy}
              onClick={() => onMove(-1)}
              className="flex h-11 flex-1 items-center justify-center rounded-control border border-border disabled:opacity-40"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              aria-label="Ниже"
              disabled={index === count - 1 || busy}
              onClick={() => onMove(1)}
              className="flex h-11 flex-1 items-center justify-center rounded-control border border-border disabled:opacity-40"
            >
              <ArrowDown size={16} />
            </button>
          </div>

          <Button type="button" variant="secondary" onClick={() => setReplacing((value) => !value)}>
            {replacing ? 'Не заменять' : 'Заменить на другое'}
          </Button>
          {replacing ? (
            <ReplaceList
              catalog={catalog}
              currentExerciseId={item.exerciseId}
              onPick={(exerciseId) => {
                setReplacing(false)
                onPatch({
                  ops: [{ op: 'replace_exercise', programExerciseId: item.id, exerciseId }],
                })
              }}
            />
          ) : null}

          {removing ? (
            <div className="flex flex-col gap-2 rounded-control border border-border p-3">
              <p className="text-[14px] text-text-secondary">
                Убрать из плана? История весов останется, упражнение можно добавить снова.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onPatch({ ops: [{ op: 'remove_exercise', programExerciseId: item.id }] })
                  }
                >
                  Убрать
                </Button>
                <Button type="button" variant="secondary" onClick={() => setRemoving(false)}>
                  Оставить
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRemoving(true)}
              className="h-11 text-[14px] text-text-muted"
            >
              Убрать из плана
            </button>
          )}
        </div>
      ) : null}
    </li>
  )
}

/** «Мой план»: клиент сам меняет схему, порядок и состав своей программы. Каждое изменение видно Максиму. */
export function MyPlan({
  programId,
  programName,
  days,
  catalog,
  history,
}: {
  programId: string
  programName: string
  days: PlanDay[]
  catalog: CatalogItem[]
  history: PlanChange[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  /** Свёрнутые дни: по умолчанию все раскрыты. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  function toggleDay(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function patch(next: ProgramPatch) {
    setError(null)
    startTransition(async () => {
      const result = await patchMyPlanAction({ programId, patch: next })
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function move(day: PlanDay, index: number, delta: number) {
    const ids = day.exercises.map((item) => item.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved!)
    patch({ ops: [{ op: 'reorder', dayId: day.id, orderedIds: ids }] })
  }

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Мой план</h1>
        <p className="text-[15px] text-text-secondary">
          {programName}. Меняй под себя — Максим увидит все правки.
        </p>
      </header>

      {error ? (
        <p className="rounded-card border border-warning/40 px-3 py-2 text-[14px] text-warning">
          {error}
        </p>
      ) : null}

      {days.length > 1 ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="min-h-9 rounded-full border border-border px-3 text-[13px] text-text-secondary"
          >
            Развернуть всё
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(days.map((day) => day.id)))}
            className="min-h-9 rounded-full border border-border px-3 text-[13px] text-text-secondary"
          >
            Свернуть всё
          </button>
        </div>
      ) : null}

      {days.map((day) => {
        const open = !collapsed.has(day.id)

        return (
          <section key={day.id} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => toggleDay(day.id)}
              aria-expanded={open}
              className="flex min-h-12 items-center justify-between gap-2 rounded-card border border-border bg-surface-1 px-3 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
                  aria-hidden
                />
                <span className="truncate text-[17px] font-semibold">{day.name}</span>
              </span>
              <span className="shrink-0 text-[13px] text-text-muted">
                {formatDuration(day.minutes)} · {day.exercises.length}
              </span>
            </button>
            {open ? (
              <>
                <ul className="flex flex-col gap-2">
                  {day.exercises.map((item, index) => (
                    <ExerciseRow
                      key={`${item.id}-${item.exerciseId}-${item.sets}-${item.repMin}-${item.repMax}-${item.restSec}`}
                      item={item}
                      index={index}
                      count={day.exercises.length}
                      catalog={catalog}
                      busy={pending}
                      onPatch={patch}
                      onMove={(delta) => move(day, index, delta)}
                    />
                  ))}
                </ul>
                <AddExercise
                  catalog={catalog}
                  onAdd={(exerciseId) =>
                    patch({
                      ops: [
                        {
                          op: 'add_exercise',
                          dayId: day.id,
                          exerciseId,
                          sets: 3,
                          repMin: 10,
                          repMax: 12,
                          restSec: 90,
                        },
                      ],
                    })
                  }
                />
              </>
            ) : null}
          </section>
        )
      })}

      {history.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">Что менялось</h2>
          {history.map((change) => (
            <div key={change.id} className="rounded-control border border-border px-3 py-2">
              <p className="text-[13px] text-text-muted">
                {change.who} · {dateFormat.format(new Date(change.at))}
              </p>
              {change.lines.slice(0, 4).map((line, index) => (
                <p key={index} className="text-[14px] text-text-secondary">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </main>
  )
}
