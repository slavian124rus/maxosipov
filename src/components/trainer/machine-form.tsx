'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChunkedUpload } from '@/components/upload/use-chunked-upload'
import { formatStep } from '@/components/trainer/machine-values'
import type { MachineListItem } from '@/modules/catalog'
import { saveMachineAction, type MachineState } from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: MachineState = { error: null, ok: false, id: null }

/** Готовые шаги веса зала: стойка и блочные тренажёры. */
const STEP_CHOICES = ['1', '2,5', '5'] as const

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

export type MachineFormProps = {
  /** Существующий тренажёр — форма работает в режиме правки. */
  machine?: MachineListItem | null
  /** Зоны, которые уже есть в зале: подсказки-чипы, но вписать новую тоже можно. */
  zones: string[]
  onSaved?: () => void
}

/**
 * Форма тренажёра (DESIGN.md §8.9): название, зона, шаг веса и фото.
 * Одна и та же форма создаёт новый тренажёр и правит существующий.
 */
export function MachineForm({ machine = null, zones, onSaved }: MachineFormProps) {
  const [state, formAction, pending] = useActionState(saveMachineAction, INITIAL)
  const upload = useChunkedUpload()

  const [name, setName] = useState(machine?.name ?? '')
  const [zone, setZone] = useState(machine?.zone ?? '')
  const [step, setStep] = useState(formatStep(machine?.weightStepKg ?? 5))
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(machine?.photoMediaId ?? null)
  // Пока фото обрабатывается на сервере, показываем локальный файл: миниатюра видна сразу.
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const localUrl = useRef<string | null>(null)

  function clearLocalPreview(): void {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current)
    localUrl.current = null
    setLocalPreview(null)
  }

  // Форма пересоздаётся под каждый тренажёр (key у родителя), поэтому поля не сбрасываем вручную.
  useEffect(() => {
    if (state.ok) onSaved?.()
  }, [state.ok, state.id, onSaved])

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
        <div className="flex gap-2">
          {STEP_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setStep(choice)}
              aria-pressed={step === choice}
              className={`min-h-11 flex-1 rounded-control border text-[15px] ${
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
            inputMode="decimal"
            value={step}
            onChange={(event) => setStep(event.target.value.replace(/[^\d.,]/g, ''))}
            className="w-24"
          />
        </div>
        <p className="text-[13px] text-text-muted">Клиент будет прибавлять вес с этим шагом.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="machine-photo">Фото тренажёра</Label>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка и локальный файл
          <img
            src={preview}
            alt={`Фото: ${name || 'тренажёр'}`}
            className="h-40 w-full rounded-card border border-border object-cover"
          />
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

        <label
          htmlFor="machine-photo"
          className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-border bg-surface-2 px-4 text-[15px] text-text ${
            upload.uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {upload.uploading
            ? `Загружаем… ${upload.progress}%`
            : preview
              ? 'Заменить фото'
              : 'Загрузить фото'}
        </label>
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
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-[15px] text-success">Сохранено</p> : null}

      <Button type="submit" disabled={pending || upload.uploading}>
        {pending ? 'Сохраняем…' : machine ? 'Сохранить' : 'Добавить тренажёр'}
      </Button>
    </form>
  )
}

