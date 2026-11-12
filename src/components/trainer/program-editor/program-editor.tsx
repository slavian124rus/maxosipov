'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { formatScheme } from '@/shared/scheme'
import type { ProgramPatch, ProgramTree, ProgramTreeDay } from '@/modules/training'
import { patchProgramAction, saveAsTemplateAction } from '@/app/(app)/app/trainer/programs/actions'
import { AddExercise, NoteInput, ReplaceList, SchemeSteppers, WeightInput } from './editor-scheme'

export type CatalogItem = {
  id: string
  name: string
  machineName: string | null
  /** Зона тренажёра — по ней в редакторе фильтруются упражнения. */
  zone: string | null
  primary: string[]
}

type Props = {
  program: ProgramTree
  catalog: CatalogItem[]
  clientId?: string | null
}

type Panel = { kind: 'scheme' | 'replace' | 'weight' | 'note'; exerciseId: string } | null

/** Карточка упражнения с ручкой перетаскивания (DESIGN.md §8.9). */
function SortableExercise({
  id,
  name,
  machineName,
  scheme,
  note,
  targetWeightKg,
  onScheme,
  onReplace,
  onWeight,
  onNote,
  onRemove,
}: {
  id: string
  name: string
  machineName: string | null
  scheme: string
  note: string | null
  targetWeightKg: number | null
  onScheme: () => void
  onReplace: () => void
  onWeight: () => void
  onNote: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [menu, setMenu] = useState(false)

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Перетащить ${name}`}
          className="flex h-11 w-8 items-center justify-center text-text-muted"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        <div className="flex flex-1 flex-col">
          <p className="text-[15px] text-text">{name}</p>
          <p className="text-[13px] text-text-muted">
            {machineName ?? 'Свободные веса'}
            {targetWeightKg !== null ? ` · ${targetWeightKg} кг` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={onScheme}
          className="rounded-control bg-surface-2 px-3 py-2 text-[13px] text-text"
        >
          {scheme}
        </button>
      </div>

      {note ? <p className="text-[13px] text-text-secondary">{note}</p> : null}

      <button type="button" className="self-start text-[13px] text-accent" onClick={() => setMenu(!menu)}>
        {menu ? 'Скрыть' : 'Изменить'}
      </button>

      {menu ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onReplace}>
            Заменить
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onWeight}>
            Целевой вес
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onNote}>
            Заметка
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onRemove}>
            Удалить
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** Редактор программы: дни вкладками, перетаскивание, степперы, замена, шаблон. */
export function ProgramEditor({ program, catalog, clientId = null }: Props) {
  const router = useRouter()
  const [days, setDays] = useState<ProgramTreeDay[]>(program.days)
  const [activeDayId, setActiveDayId] = useState<string | null>(program.days[0]?.id ?? null)
  const [panel, setPanel] = useState<Panel>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // После refresh приходят новые данные программы — подхватываем их во время рендера
  // (паттерн React вместо setState в эффекте).
  const signature = useMemo(() => JSON.stringify(program.days), [program.days])
  const [syncedSignature, setSyncedSignature] = useState(signature)

  if (syncedSignature !== signature) {
    setSyncedSignature(signature)
    setDays(program.days)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const day = days.find((item) => item.id === activeDayId) ?? days[0] ?? null
  const current = panel && day ? day.exercises.find((item) => item.id === panel.exerciseId) : undefined

  function run(patch: ProgramPatch): void {
    setError(null)
    startTransition(async () => {
      const result = await patchProgramAction({ programId: program.id, patch, clientId })
      if (result.error) {
        setError(result.error)
        // Перетаскивание показано сразу, до ответа сервера: при ошибке возвращаем порядок как в базе.
        setDays(program.days)
      } else router.refresh()
    })
  }

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || !day || active.id === over.id) return

    const ids = day.exercises.map((item) => item.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const ordered = arrayMove(ids, from, to)
    setDays((items) =>
      items.map((item) =>
        item.id === day.id
          ? { ...item, exercises: ordered.map((id) => item.exercises.find((entry) => entry.id === id)!) }
          : item,
      ),
    )
    run({ ops: [{ op: 'reorder', dayId: day.id, orderedIds: ordered }] })
  }

  function saveTemplate(): void {
    const name = window.prompt('Название шаблона', program.name)
    if (!name) return

    setError(null)
    startTransition(async () => {
      const result = await saveAsTemplateAction({ programId: program.id, name, clientId })
      if (result.error) setError(result.error)
      else router.push(`/trainer/programs/${result.id}`)
    })
  }

  if (!day) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] text-text-secondary">В программе нет дней</p>
        <Button
          type="button"
          onClick={() => run({ ops: [{ op: 'add_day', name: 'День 1' }] })}
          disabled={pending}
        >
          Добавить день
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveDayId(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
              item.id === day.id
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border text-text-secondary'
            }`}
          >
            {item.name}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ ops: [{ op: 'add_day', name: `День ${days.length + 1}` }] })}
          className="shrink-0 rounded-full border border-dashed border-border px-3 py-1.5 text-[13px] text-text-secondary"
        >
          + День
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={day.exercises.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {day.exercises.map((item) => {
              const info = catalog.find((entry) => entry.id === item.exerciseId)

              return (
                <SortableExercise
                  key={item.id}
                  id={item.id}
                  name={info?.name ?? 'Упражнение'}
                  machineName={info?.machineName ?? null}
                  scheme={formatScheme(item.sets, item.repMin, item.repMax)}
                  note={item.note}
                  targetWeightKg={item.targetWeightKg}
                  onScheme={() => setPanel({ kind: 'scheme', exerciseId: item.id })}
                  onReplace={() => setPanel({ kind: 'replace', exerciseId: item.id })}
                  onWeight={() => setPanel({ kind: 'weight', exerciseId: item.id })}
                  onNote={() => setPanel({ kind: 'note', exerciseId: item.id })}
                  onRemove={() =>
                    run({ ops: [{ op: 'remove_exercise', programExerciseId: item.id }] })
                  }
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <AddExercise
        catalog={catalog}
        onAdd={(exerciseId) =>
          run({
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

      {panel && current ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-sheet border-t border-border bg-surface-1 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-semibold">
              {panel.kind === 'scheme'
                ? 'Схема'
                : panel.kind === 'replace'
                  ? 'Заменить упражнение'
                  : panel.kind === 'weight'
                    ? 'Целевой вес'
                    : 'Заметка'}
            </p>
            <button
              type="button"
              className="text-[15px] text-text-secondary"
              onClick={() => setPanel(null)}
            >
              Закрыть
            </button>
          </div>

          {panel.kind === 'scheme' ? (
            <SchemeSteppers
              sets={current.sets}
              repMin={current.repMin}
              repMax={current.repMax}
              restSec={current.restSec}
              onChange={(values) => {
                setPanel(null)
                run({ ops: [{ op: 'set_sets_reps', programExerciseId: current.id, ...values }] })
              }}
            />
          ) : null}

          {panel.kind === 'replace' ? (
            <ReplaceList
              catalog={catalog}
              currentExerciseId={current.exerciseId}
              onPick={(exerciseId) => {
                setPanel(null)
                run({ ops: [{ op: 'replace_exercise', programExerciseId: current.id, exerciseId }] })
              }}
            />
          ) : null}

          {panel.kind === 'weight' ? (
            <WeightInput
              value={current.targetWeightKg}
              onSave={(weightKg) => {
                setPanel(null)
                run({ ops: [{ op: 'set_target_weight', programExerciseId: current.id, weightKg }] })
              }}
            />
          ) : null}

          {panel.kind === 'note' ? (
            <NoteInput
              value={current.note}
              onSave={(note) => {
                setPanel(null)
                run({ ops: [{ op: 'set_note', programExerciseId: current.id, note }] })
              }}
            />
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <Button type="button" variant="outline" onClick={saveTemplate} disabled={pending}>
        Сохранить как шаблон
      </Button>
    </div>
  )
}