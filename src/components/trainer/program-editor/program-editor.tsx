'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
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
import { Pencil, Trash2 } from 'lucide-react'
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
import { formatScheme } from '@/shared/scheme'
import { exercisesLabel } from '@/shared/plural'
import type { ProgramPatch, ProgramTree, ProgramTreeDay } from '@/modules/training'
import { patchProgramAction, saveAsTemplateAction } from '@/app/(app)/app/trainer/programs/actions'
import { AddExercise } from './editor-scheme'

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

/**
 * Строка упражнения в дне. Вся карточка — ссылка на страницу упражнения
 * (`/trainer/programs/<id>/exercises/<itemId>`): там правятся подходы, вес и заметка.
 * Ручка слева остаётся только для перетаскивания.
 */
function SortableExercise({
  id,
  href,
  name,
  machineName,
  scheme,
  note,
  targetWeightKg,
}: {
  id: string
  href: string
  name: string
  machineName: string | null
  scheme: string
  note: string | null
  targetWeightKg: number | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-1 rounded-card border border-border bg-surface-1 pr-2"
    >
      <button
        type="button"
        aria-label={`Перетащить ${name}`}
        className="flex w-9 shrink-0 items-center justify-center text-text-muted"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <Link href={href} className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
        <span className="text-[15px] text-text">{name}</span>
        <span className="text-[13px] text-text-muted">
          {machineName ?? 'Свободные веса'}
          {targetWeightKg !== null ? ` · ${targetWeightKg} кг` : ''}
        </span>
        {note ? <span className="text-[13px] text-text-secondary">{note}</span> : null}
        <span className="mt-0.5 w-fit rounded-control bg-surface-2 px-2.5 py-1 text-[13px] text-text">
          {scheme}
        </span>
      </Link>

      <span aria-hidden className="flex items-center pl-1 text-text-muted">
        ›
      </span>
    </div>
  )
}

/**
 * Редактор программы: дни чипами (имя дня правится на месте), упражнения
 * списком с перетаскиванием, добавление из каталога. Правка упражнения —
 * на отдельной странице (DESIGN.md §8.9).
 */
export function ProgramEditor({ program, catalog, clientId = null }: Props) {
  const router = useRouter()
  const [days, setDays] = useState<ProgramTreeDay[]>(program.days)
  const [activeDayId, setActiveDayId] = useState<string | null>(program.days[0]?.id ?? null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [deleting, setDeleting] = useState(false)
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

  function startRename(): void {
    if (!day) return
    setDraftName(day.name)
    setRenaming(true)
  }

  function saveDayName(): void {
    if (!day) return

    const name = draftName.trim()
    if (name.length === 0) return
    if (name === day.name) {
      setRenaming(false)
      return
    }

    setRenaming(false)
    run({ ops: [{ op: 'rename_day', dayId: day.id, name }] })
  }

  /**
   * Удаление дня вместе с упражнениями. Сразу переключаемся на соседний день, чтобы
   * после исчезновения активного не «прыгать» в начало списка; при ошибке сервера
   * `run` вернёт дни как в базе.
   */
  function deleteDay(): void {
    if (!day) return

    const index = days.findIndex((item) => item.id === day.id)
    const neighbour = days[index + 1] ?? days[index - 1] ?? null

    setDeleting(false)
    setRenaming(false)
    setActiveDayId(neighbour?.id ?? null)
    setDays((items) => items.filter((item) => item.id !== day.id))
    run({ ops: [{ op: 'delete_day', dayId: day.id }] })
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
      <div className="flex gap-2 scroll-row pb-1">
        {days.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setRenaming(false)
              setActiveDayId(item.id)
            }}
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

      {renaming ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            saveDayName()
          }}
        >
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            aria-label="Название дня"
            maxLength={80}
            autoFocus
            className="h-11 min-w-[180px] flex-1"
          />
          <Button type="submit" disabled={pending || draftName.trim().length === 0} className="h-11">
            Сохранить
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => setRenaming(false)}
          >
            Отмена
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-[17px] font-semibold">{day.name}</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={startRename}>
              <Pencil size={15} strokeWidth={1.75} aria-hidden />
              Переименовать день
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(true)}
              className="text-danger"
            >
              <Trash2 size={15} strokeWidth={1.75} aria-hidden />
              Удалить день
            </Button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={day.exercises.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {day.exercises.length === 0 ? (
              <p className="text-[15px] text-text-secondary">
                В этом дне пока нет упражнений — добавь ниже
              </p>
            ) : null}

            {day.exercises.map((item) => {
              const info = catalog.find((entry) => entry.id === item.exerciseId)

              return (
                <SortableExercise
                  key={item.id}
                  id={item.id}
                  href={`/trainer/programs/${program.id}/exercises/${item.id}`}
                  name={info?.name ?? 'Упражнение'}
                  machineName={info?.machineName ?? null}
                  scheme={formatScheme(item.sets, item.repMin, item.repMax)}
                  note={item.note}
                  targetWeightKg={item.targetWeightKg}
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

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {clientId ? (
        <Button type="button" variant="outline" onClick={saveTemplate} disabled={pending}>
          Сохранить как шаблон
        </Button>
      ) : null}

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="grid grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>Удалить день «{day.name}»?</DialogTitle>
            <DialogDescription>
              {day.exercises.length > 0
                ? `День исчезнет вместе с упражнениями: ${exercisesLabel(day.exercises.length)}. `
                : 'День пустой, так что пропадёт только он. '}
              Выполненные тренировки и записанные веса клиентов останутся в истории.
              {days.length === 1
                ? ' Это последний день — в программе не останется ни одного, добавь новый.'
                : ''}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleting(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={deleteDay}>
              {pending ? 'Удаляем…' : 'Удалить день'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
