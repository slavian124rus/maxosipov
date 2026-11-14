'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChunkedUpload } from '@/components/upload/use-chunked-upload'
import { PhotoViewer } from '@/components/ui/photo-viewer'
import { formatStep, isNoWeight, parseWeightStep } from '@/components/trainer/machine-values'
import { exercisesLabel } from '@/shared/plural'
import type { MachineListItem } from '@/modules/catalog'
import {
  deleteMachineAction,
  saveMachineAction,
  type MachineState,
} from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: MachineState = { error: null, ok: false, id: null }

/** Готовые шаги веса зала: стойка и блочные тренажёры. */
const STEP_CHOICES = ['1', '2,5', '5'] as const

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

export type MachineFormProps = {
  /** Существующий тренажёр — форма работает в режиме правки. */
  machine?: MachineListItem | null
  /** Зоны, которые уже есть в зале: подсказки-чипы, но вписать новую тоже можно. */
  zones: string[]
  /** Сколько упражнений привязано к тренажёру: с ними удалить нельзя. */
  exerciseCount?: number
  onSaved?: () => void
  /** Тренажёр удалён — лист можно закрыть. */
  onDeleted?: () => void
}

/**
 * Форма тренажёра (DESIGN.md §8.9): название, зона, шаг веса и фото.
 * Одна и та же форма создаёт новый тренажёр и правит существующий.
 */
export function MachineForm({
  machine = null,
  zones,
  exerciseCount = 0,
  onSaved,
  onDeleted,
}: MachineFormProps) {
  const [state, formAction, pending] = useActionState(saveMachineAction, INITIAL)
  const upload = useChunkedUpload()

  const [name, setName] = useState(machine?.name ?? '')
  const [zone, setZone] = useState(machine?.zone ?? '')
  const [step, setStep] = useState(formatStep(machine?.weightStepKg ?? 5))
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(machine?.photoMediaId ?? null)
  // Пока фото обрабатывается на сервере, показываем локальный файл: миниатюра видна сразу.
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  /** Фото открыто целиком: в форме оно обрезано, а рассмотреть тренажёр нужно. */
  const [photoOpen, setPhotoOpen] = useState(false)
  const localUrl = useRef<string | null>(null)

  function clearLocalPreview(): void {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current)
    localUrl.current = null
    setLocalPreview(null)
  }

  // Форма пересоздаётся под каждый тренажёр (key у родителя), поэтому поля не сбрасываем вручную.
  useEffect(() => {
    if (!state.ok) return

    // Лист закрывается сразу, поэтому подтверждение показываем тостом, а не строкой в форме.
    toast.success(machine ? 'Тренажёр сохранён' : 'Тренажёр добавлен', {
      description: name || undefined,
    })
    onSaved?.()
  }, [state.ok, state.id, onSaved, machine, name])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  // Локальный превью-файл живёт только пока форма открыта.
  useEffect(
    () => () => {
      if (localUrl.current) URL.revokeObjectURL(localUrl.current)
      localUrl.current = null
    },
    [],
  )

  async function uploadPhoto(file: File): Promise<void> {
    clearLocalPreview()
    localUrl.current = URL.createObjectURL(file)
    setLocalPreview(localUrl.current)

    const id = await upload.upload(file, 'machine_photo')
    if (id) setPhotoMediaId(id)
    else clearLocalPreview()
  }

  function removePhoto(): void {
    clearLocalPreview()
    setPhotoMediaId(null)
  }

  const preview = localPreview ?? machine?.photoUrl ?? machine?.thumbUrl ?? null
  const zoneChoices = zones.filter((item) => item.trim().length > 0)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={machine?.id ?? ''} />
      <input type="hidden" name="photoMediaId" value={photoMediaId ?? ''} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="zone" value={zone} />
      <input type="hidden" name="weightStepKg" value={step} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="machine-name">Название</Label>
        <Input
          id="machine-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Блочный тренажёр (нижняя тяга)"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="machine-zone">Зона</Label>
        <Input
          id="machine-zone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          placeholder="Спина"
        />
        {zoneChoices.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {zoneChoices.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setZone(zone === item ? '' : item)}
                aria-pressed={zone === item}
                className={`min-h-9 rounded-full border px-3 text-[13px] ${
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="machine-step">Шаг веса, кг</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStep('0')}
            aria-pressed={step === '0' || step === '0,0'}
            className={`min-h-11 rounded-control border px-3 text-[15px] ${
              isNoWeight(parseWeightStep(step))
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            Без веса
          </button>
          {STEP_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setStep(choice)}
              aria-pressed={step === choice}
              className={`min-h-11 w-16 rounded-control border text-[15px] ${
                step === choice
                  ? 'border-accent bg-surface-2 text-text'
                  : 'border-border bg-surface-1 text-text-secondary'
              }`}
            >
              {choice}
            </button>
          ))}
          <Input
            id="machine-step"
            aria-label="Свой шаг веса"
            inputMode="decimal"
            value={step}
            onChange={(event) => setStep(event.target.value.replace(/[^\d.,]/g, ''))}
            className="w-24"
          />
        </div>
        <p className="text-[13px] text-text-muted">
          {isNoWeight(parseWeightStep(step))
            ? 'Вес не задаётся — подходит для кардио: дорожка, велотренажёр, эллипс.'
            : 'Клиент будет прибавлять вес с этим шагом.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="machine-photo">Фото тренажёра</Label>

        {preview ? (
          // Фото в форме обрезано под плитку — касание открывает его целиком.
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="Открыть фото тренажёра целиком"
            className="block w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка и локальный файл */}
            <img
              src={preview}
              alt={`Фото: ${name || 'тренажёр'}`}
              className="h-40 w-full rounded-card border border-border object-cover"
            />
          </button>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-card border border-dashed border-border bg-surface-1 text-[13px] text-text-muted">
            Фото пока нет
          </div>
        )}

        {localPreview || machine?.photoStatus === 'processing' ? (
          <p className="text-[13px] text-text-muted">
            Фото обрабатывается — появится через минуту.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label
            htmlFor="machine-photo-camera"
            className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-control bg-accent px-4 text-[15px] font-medium text-white ${
              upload.uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            Сделать фото
          </label>
          <label
            htmlFor="machine-photo"
            className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-border bg-surface-2 px-4 text-[15px] text-text ${
              upload.uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {preview ? 'Заменить фото' : 'Загрузить фото'}
          </label>
        </div>
        {upload.uploading ? (
          <p className="text-[13px] text-text-secondary">Загружаем… {upload.progress}%</p>
        ) : null}
        <input
          id="machine-photo-camera"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={upload.uploading}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadPhoto(file)
            event.target.value = ''
          }}
        />
        <input
          id="machine-photo"
          type="file"
          accept={PHOTO_ACCEPT}
          disabled={upload.uploading}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadPhoto(file)
            event.target.value = ''
          }}
        />
        <p className="text-[13px] text-text-muted">
          Пока у упражнения нет видео, клиент видит это фото с подписью «Видео скоро».
        </p>

        {preview || photoMediaId ? (
          <button
            type="button"
            onClick={removePhoto}
            className="min-h-11 w-fit rounded-full border border-border px-4 text-[13px] text-text-secondary"
          >
            Убрать фото
          </button>
        ) : null}

        {upload.error ? <p className="text-[15px] text-danger">{upload.error}</p> : null}

        <PhotoViewer
          src={preview}
          alt={`Фото: ${name || 'тренажёр'}`}
          open={photoOpen}
          onOpenChange={setPhotoOpen}
        />
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-[15px] text-success">Сохранено</p> : null}

      <Button type="submit" disabled={pending || upload.uploading}>
        {pending ? 'Сохраняем…' : machine ? 'Сохранить' : 'Добавить тренажёр'}
      </Button>

      {machine ? (
        <DeleteMachine
          machineId={machine.id}
          name={machine.name}
          exerciseCount={exerciseCount}
          onDeleted={onDeleted}
        />
      ) : null}
    </form>
  )
}

/**
 * Удаление тренажёра, занесённого по ошибке. Удаляем только без упражнений:
 * у упражнений есть история подходов (CLAUDE.md, правило 6), поэтому сначала
 * их переносят на другой тренажёр — до тех пор кнопка неактивна и объясняет почему.
 */
function DeleteMachine({
  machineId,
  name,
  exerciseCount,
  onDeleted,
}: {
  machineId: string
  name: string
  exerciseCount: number
  onDeleted?: () => void
}) {
  const [state, formAction, pending] = useActionState(deleteMachineAction, INITIAL)
  const [confirming, setConfirming] = useState(false)
  const blocked = exerciseCount > 0

  // Удаление прошло — лист с формой закрываем, дерево уже обновилось с сервера.
  useEffect(() => {
    if (state.ok) onDeleted?.()
  }, [state.ok, state.id, onDeleted])

  // Сервер отказал (например, упражнение добавили в другой вкладке) — окно остаётся открытым,
  // а текст ошибки показываем прямо в нём: так понятно, почему ничего не удалилось.
  // Ошибку показываем только пока окно открыто, чтобы после «Понятно» оно открывалось чистым.
  const failed = confirming && state.error !== null

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-card border border-danger/30 px-4 py-4">
      <p className="text-[15px] text-text">Удалить тренажёр</p>

      {blocked ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-control border border-warning/40 bg-surface-2 px-3 py-2.5"
        >
          <p className="text-[13px] text-warning">
            К тренажёру привязано {exercisesLabel(exerciseCount)} — удалить нельзя.
          </p>
          <p className="text-[13px] text-text-secondary">
            Сначала открой эти упражнения в «Упражнениях» и выбери им другой тренажёр (или
            «Без тренажёра»), тогда удаление станет доступно.
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-text-muted">
          Если занёс по ошибке — удали. Фото тоже удалится, вернуть нельзя.
        </p>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <Button
          type="button"
          variant="destructive"
          disabled={blocked}
          onClick={() => setConfirming(true)}
          className="w-fit"
        >
          Удалить
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {failed ? 'Удалить не получилось' : `Удалить «${name}»?`}
            </DialogTitle>
            <DialogDescription>
              {failed
                ? 'Тренажёр остался в каталоге — ниже причина.'
                : 'Тренажёр и его фото исчезнут из каталога. Это необратимо.'}
            </DialogDescription>
          </DialogHeader>

          {failed ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-control border border-danger/40 bg-surface-2 px-3 py-2.5"
            >
              <p className="text-[13px] text-danger">{state.error}</p>
              <p className="text-[13px] text-text-secondary">
                Открой эти упражнения в «Упражнениях» и выбери им другой тренажёр — после этого
                удаление сработает.
              </p>
            </div>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="id" value={machineId} />
            <DialogFooter>
              {failed ? (
                <Button type="button" onClick={() => setConfirming(false)}>
                  Понятно
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" variant="destructive" disabled={pending}>
                    {pending ? 'Удаляем…' : 'Удалить'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

