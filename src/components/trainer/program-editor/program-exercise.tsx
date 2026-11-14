'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatScheme } from '@/shared/scheme'
import type { ProgramPatch, ProgramTreeExercise } from '@/modules/training'
import { patchProgramAction } from '@/app/(app)/app/trainer/programs/actions'
import { ReplaceList, Stepper } from './editor-scheme'
import type { CatalogItem } from './program-editor'

type Props = {
  programId: string
  clientId: string | null
  /** Куда возвращает «К шаблону» и «Удалить». */
  backHref: string
  backLabel: string
  dayName: string
  item: ProgramTreeExercise
  exerciseName: string
  catalog: CatalogItem[]
}

type Scheme = { sets: number; repMin: number; repMax: number; restSec: number }

function weightToText(value: number | null): string {
  return value === null ? '' : String(value)
}

/** Подгоняет список весов под число подходов: недостающие повторяют последний. */
function fitTexts(values: string[], count: number): string[] {
  if (values.length >= count) return values.slice(0, count)
  const last = values[values.length - 1] ?? ''
  return [...values, ...Array<string>(count - values.length).fill(last)]
}

function parseWeight(text: string): number | null {
  const parsed = Number(text.trim().replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(parsed) ? null : parsed
}

/**
 * Упражнение внутри программы отдельной страницей (DESIGN.md §8.9): подходы,
 * повторения, отдых, вес и заметка правятся здесь, а не в шторке поверх списка.
 * «Сохранить» отправляет один патч только с изменёнными полями.
 */
export function ProgramExerciseEditor({
  programId,
  clientId,
  backHref,
  backLabel,
  dayName,
  item,
  exerciseName,
  catalog,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const initialWeights = item.setWeights?.map(String) ?? null
  const [saved, setSaved] = useState<Scheme & { weight: string; note: string; perSet: boolean; weights: string }>({
    sets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    restSec: item.restSec,
    weight: weightToText(item.targetWeightKg),
    note: item.note ?? '',
    perSet: initialWeights !== null,
    weights: (initialWeights ?? []).join('|'),
  })

  const [sets, setSets] = useState(item.sets)
  const [repMin, setRepMin] = useState(item.repMin)
  const [repMax, setRepMax] = useState(item.repMax)
  const [restSec, setRestSec] = useState(item.restSec)
  const [weight, setWeight] = useState(weightToText(item.targetWeightKg))
  // «Один вес на все подходы» или свой вес у каждого подхода (15, 20, 20…).
  const [perSet, setPerSet] = useState(initialWeights !== null)
  const [weightList, setWeightList] = useState<string[]>(
    initialWeights ?? Array<string>(item.sets).fill(weightToText(item.targetWeightKg)),
  )
  const shownWeights = fitTexts(weightList, sets)
  const [note, setNote] = useState(item.note ?? '')

  const [replacing, setReplacing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    sets !== saved.sets ||
    repMin !== saved.repMin ||
    repMax !== saved.repMax ||
    restSec !== saved.restSec ||
    weight !== saved.weight ||
    perSet !== saved.perSet ||
    (perSet && shownWeights.join('|') !== saved.weights) ||
    note !== saved.note

  function send(patch: ProgramPatch, after?: () => void): void {
    setError(null)

    startTransition(async () => {
      const result = await patchProgramAction({ programId, patch, clientId })

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      after?.()
      router.refresh()
    })
  }

  function save(): void {
    const ops: ProgramPatch['ops'] = []

    if (sets !== saved.sets || repMin !== saved.repMin || repMax !== saved.repMax || restSec !== saved.restSec) {
      ops.push({ op: 'set_sets_reps', programExerciseId: item.id, sets, repMin, repMax, restSec })
    }

    if (perSet) {
      const parsed = shownWeights.map(parseWeight)
      if (parsed.some((value) => value === null)) {
        setError('Укажи вес каждого подхода')
        return
      }
      if (!saved.perSet || shownWeights.join('|') !== saved.weights || sets !== saved.sets) {
        ops.push({ op: 'set_set_weights', programExerciseId: item.id, weights: parsed as number[] })
      }
    } else if (saved.perSet && weight === saved.weight) {
      // Вернулись к одному весу: рабочий вес остаётся прежним, веса по подходам очищаются.
      ops.push({ op: 'set_set_weights', programExerciseId: item.id, weights: null })
    } else if (weight !== saved.weight || saved.perSet) {
      ops.push({ op: 'set_target_weight', programExerciseId: item.id, weightKg: parseWeight(weight) })
    }

    if (note !== saved.note) {
      ops.push({ op: 'set_note', programExerciseId: item.id, note: note.trim() === '' ? null : note.trim() })
    }

    if (ops.length === 0) return

    send({ ops }, () => {
      setSaved({
        sets,
        repMin,
        repMax,
        restSec,
        weight,
        note,
        perSet,
        weights: perSet ? shownWeights.join('|') : '',
      })
      toast.success('Сохранено', { description: `${exerciseName}: ${formatScheme(sets, repMin, repMax)}` })
    })
  }

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-1 px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Схема</h2>
          <span className="text-[13px] text-text-muted">{dayName}</span>
        </div>

        <p className="text-[15px] text-text">
          {formatScheme(sets, repMin, repMax)} · отдых {restSec} с
        </p>

        <Stepper label="Подходы" value={sets} min={1} max={10} step={1} onChange={setSets} />
        <Stepper
          label="Повторения от"
          value={repMin}
          min={1}
          max={50}
          step={1}
          onChange={(value) => {
            setRepMin(value)
            setRepMax(Math.max(value, repMax))
          }}
        />
        <Stepper
          label="Повторения до"
          value={repMax}
          min={1}
          max={50}
          step={1}
          onChange={(value) => {
            setRepMax(value)
            setRepMin(Math.min(value, repMin))
          }}
        />
        <Stepper
          label="Отдых, секунд"
          value={restSec}
          min={0}
          max={300}
          step={15}
          onChange={setRestSec}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
        <h2 className="text-[17px] font-semibold">Целевой вес</h2>
        <p className="text-[13px] text-text-muted">
          Ориентир для клиента. Пустое поле — вес подбирается по прогрессии
        </p>

        <div role="group" aria-label="Как задан вес" className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: 'Один вес' },
            { value: true, label: 'По подходам' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={perSet === option.value}
              onClick={() => {
                if (option.value === perSet) return
                if (option.value) setWeightList(Array<string>(sets).fill(weight))
                setPerSet(option.value)
              }}
              className={`min-h-12 rounded-control border px-3 text-[15px] ${
                perSet === option.value
                  ? 'border-accent bg-surface-2 text-text'
                  : 'border-border bg-bg text-text-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {perSet ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-text-muted">
              Например, 1-й подход 15 кг, остальные по 20. Рабочим считается самый тяжёлый.
            </p>
            {shownWeights.map((value, index) => (
              <div key={index} className="flex items-center gap-3">
                <label htmlFor={`set-weight-${index}`} className="w-24 shrink-0 text-[15px] text-text-secondary">
                  Подход {index + 1}
                </label>
                <input
                  id={`set-weight-${index}`}
                  aria-label={`Вес подхода ${index + 1}`}
                  inputMode="decimal"
                  value={value}
                  onChange={(event) =>
                    setWeightList(shownWeights.map((current, at) => (at === index ? event.target.value : current)))
                  }
                  placeholder="кг"
                  className="h-12 w-full min-w-0 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
                />
              </div>
            ))}
          </div>
        ) : (
          <input
            id="exercise-weight"
            aria-label="Целевой вес"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="Например, 32,5"
            className="h-12 w-full min-w-0 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-4">
        <label htmlFor="exercise-note" className="text-[17px] font-semibold">
          Заметка
        </label>
        <p className="text-[13px] text-text-muted">Короткая подсказка клиенту по этому упражнению</p>
        <textarea
          id="exercise-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={200}
          placeholder="Например: следи за спиной"
          className="rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text"
        />
      </section>

      {error ? (
        <p role="alert" className="text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || pending} className="min-h-12">
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        <p className="text-[13px] text-text-muted">
          {dirty ? 'Есть несохранённые изменения' : 'Всё сохранено'}
        </p>
      </div>


      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[17px] font-semibold">Заменить упражнение</h2>
            <p className="text-[13px] text-text-muted">
              Сверху — упражнения на те же мышцы и тот же тренажёр
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setReplacing((value) => !value)}>
            {replacing ? 'Скрыть список' : 'Выбрать другое'}
          </Button>
        </div>

        {replacing ? (
          <ReplaceList
            catalog={catalog}
            currentExerciseId={item.exerciseId}
            onPick={(exerciseId) => {
              setReplacing(false)
              send({ ops: [{ op: 'replace_exercise', programExerciseId: item.id, exerciseId }] }, () =>
                toast.success('Упражнение заменено'),
              )
            }}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-danger/30 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-[17px] font-semibold">Убрать из программы</h2>
            <p className="text-[13px] text-text-muted">
              Упражнение уйдёт из этого дня, каталог и история клиента не изменятся
            </p>
          </div>
          <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            Убрать
          </Button>
        </div>
      </section>

      <Button asChild variant="ghost" className="w-fit">
        <Link href={backHref}>← {backLabel}</Link>
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="grid grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>Убрать «{exerciseName}» из дня?</DialogTitle>
            <DialogDescription>
              Упражнение исчезнет из программы. Выполненные подходы клиента останутся в истории.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirming(false)
                send({ ops: [{ op: 'remove_exercise', programExerciseId: item.id }] }, () => {
                  toast.success('Упражнение убрано', { description: exerciseName })
                  router.push(backHref)
                })
              }}
            >
              Убрать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
