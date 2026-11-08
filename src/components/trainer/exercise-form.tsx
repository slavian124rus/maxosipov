'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure'
import { cycleMuscle, type MuscleState } from '@/components/muscle-figure/state'
import { VideoCrop } from '@/components/trainer/video-crop'
import { useChunkedUpload } from '@/components/upload/use-chunked-upload'
import { muscleName, type MuscleCode } from '@/shared/muscles'
import type { ExerciseDetail, Machine } from '@/modules/catalog'
import { saveExerciseAction, type SaveExerciseState } from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: SaveExerciseState = { error: null, id: null }
const TOTAL_STEPS = 5

type Props = {
  machines: Pick<Machine, 'id' | 'name'>[]
  initial?: ExerciseDetail | null
}

export function ExerciseForm({ machines, initial }: Props) {
  const [state, formAction, pending] = useActionState(saveExerciseAction, INITIAL)
  const upload = useChunkedUpload()

  const [step, setStep] = useState(0)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoMediaId, setVideoMediaId] = useState<string | null>(
    initial?.videoMp4Url ? 'existing' : null,
  )
  const [cropX, setCropX] = useState(0.5)
  const [machineId, setMachineId] = useState<string>(machines[0]?.id ?? '')
  const [muscles, setMuscles] = useState<MuscleState>({
    primary: (initial?.primaryMuscles ?? []) as MuscleCode[],
    secondary: (initial?.secondaryMuscles ?? []) as MuscleCode[],
  })
  const [name, setName] = useState(initial?.name ?? '')
  const [repMin, setRepMin] = useState(String(initial?.defaultRepMin ?? 10))
  const [repMax, setRepMax] = useState(String(initial?.defaultRepMax ?? 12))
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? [''])
  const [mistakes, setMistakes] = useState<string[]>(initial?.mistakes ?? [''])
  const [tips, setTips] = useState(initial?.tips ?? '')
  const [overlayProfile, setOverlayProfile] = useState(initial?.overlayProfile ?? 'none')

  async function uploadVideo(file: File): Promise<void> {
    setVideoFile(file)
    const id = await upload.upload(file, 'exercise_video')
    if (id) setVideoMediaId(id)
  }

  const canNext = ((): boolean => {
    if (step === 0) return Boolean(videoMediaId) && !upload.uploading
    if (step === 1) return machineId !== ''
    if (step === 2) return muscles.primary.length > 0
    if (step === 3) return name.trim().length >= 2 && steps.some((item) => item.trim())
    return true
  })()

  return (
    <form action={formAction} className="flex min-h-dvh flex-col px-4 py-6">
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <input type="hidden" name="videoMediaId" value={videoMediaId === 'existing' ? '' : (videoMediaId ?? '')} />
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="primary" value={muscles.primary.join(',')} />
      <input type="hidden" name="secondary" value={muscles.secondary.join(',')} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="repMin" value={repMin} />
      <input type="hidden" name="repMax" value={repMax} />
      <input type="hidden" name="steps" value={JSON.stringify(steps.filter((item) => item.trim()))} />
      <input type="hidden" name="mistakes" value={JSON.stringify(mistakes.filter((item) => item.trim()))} />
      <input type="hidden" name="tips" value={tips} />
      <input type="hidden" name="overlayProfile" value={overlayProfile} />
      <input type="hidden" name="cropX" value={String(cropX)} />

      <div className="mb-5 h-1 w-full rounded-full bg-surface-2">
        <div
          className="h-1 rounded-full bg-accent transition-all duration-200"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {step === 0 ? (
          <>
            <h1 className="text-[22px] font-semibold">Видео</h1>
            <p className="text-[15px] text-text-secondary">
              Снимай вертикально, весь тренажёр и ты целиком, 2–3 чистых повторения.
            </p>
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadVideo(file)
              }}
              className="text-[15px] text-text-secondary"
            />
            {upload.uploading ? (
              <p className="text-[15px] text-text-secondary">Загружаем… {upload.progress}%</p>
            ) : null}
            {upload.error ? <p className="text-[15px] text-danger">{upload.error}</p> : null}
            {videoMediaId ? <p className="text-[15px] text-success">Видео загружено</p> : null}
            <VideoCrop file={videoFile} value={cropX} onChange={setCropX} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="text-[22px] font-semibold">Тренажёр</h1>
            <div className="flex flex-col gap-2">
              {machines.map((machine) => (
                <button
                  key={machine.id}
                  type="button"
                  onClick={() => setMachineId(machine.id)}
                  className={`min-h-14 rounded-card border px-4 py-3 text-left text-[17px] ${
                    machineId === machine.id
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {machine.name}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-text-muted">
              Новый тренажёр добавляется в разделе «Тренажёры».
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-[22px] font-semibold">Мышцы</h1>
            <MuscleFigure
              primary={muscles.primary}
              secondary={muscles.secondary}
              onMuscleTap={(code) => setMuscles((current) => cycleMuscle(current, code))}
              size="md"
            />
            <p className="text-[13px] text-text-muted">
              Одно касание — основная, второе — помогает, третье — убрать
            </p>
            <div className="flex flex-col gap-1 text-[15px] text-text-secondary">
              <p>Основные: {muscles.primary.map(muscleName).join(', ') || 'нет'}</p>
              <p>Помогают: {muscles.secondary.map(muscleName).join(', ') || 'нет'}</p>
            </div>
            <label className="flex flex-col gap-2 text-[15px] text-text-secondary">
              Подсветка на видео
              <select
                value={overlayProfile}
                onChange={(event) =>
                  setOverlayProfile(event.target.value as typeof overlayProfile)
                }
                className="h-12 rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text"
              >
                <option value="none">Нет</option>
                <option value="pull_vertical">Тяга сверху</option>
                <option value="pull_horizontal">Тяга горизонтальная</option>
              </select>
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-[22px] font-semibold">Описание</h1>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Название</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="repMin">Повторений от</Label>
                <Input
                  id="repMin"
                  inputMode="numeric"
                  value={repMin}
                  onChange={(event) => setRepMin(event.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="repMax">до</Label>
                <Input
                  id="repMax"
                  inputMode="numeric"
                  value={repMax}
                  onChange={(event) => setRepMax(event.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <ListEditor
              title="Как делать"
              items={steps}
              onChange={setSteps}
              placeholder="Сядь и зафиксируй колени"
            />
            <ListEditor
              title="Частые ошибки"
              items={mistakes}
              onChange={setMistakes}
              placeholder="Рывки корпусом"
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="tips">Совет</Label>
              <textarea
                id="tips"
                value={tips}
                onChange={(event) => setTips(event.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-[15px] text-text outline-none focus-visible:border-accent"
              />
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 className="text-[22px] font-semibold">Проверка</h1>
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-3">
              <p className="font-display text-[24px] leading-tight">{name || 'Без названия'}</p>
              <p className="text-[15px] text-text-secondary">
                {machines.find((machine) => machine.id === machineId)?.name ?? 'Без тренажёра'}
              </p>
              <p className="text-[15px] text-text-secondary">
                Основные: {muscles.primary.map(muscleName).join(', ') || 'не отмечены'}
              </p>
              <p className="text-[15px] text-text-secondary">
                {repMin}–{repMax} раз · шагов: {steps.filter((item) => item.trim()).length}
              </p>
              <p className="text-[13px] text-text-muted">
                {videoMediaId ? 'Видео загружено' : 'Без видео — можно сохранить только черновик'}
              </p>
            </div>

            {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
            {state.id ? <p className="text-[15px] text-success">Сохранено</p> : null}
            {state.notice ? <p className="text-[15px] text-text-secondary">{state.notice}</p> : null}
          </>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Назад
          </Button>
        ) : null}

        {step < TOTAL_STEPS - 1 ? (
          <Button
            type="button"
            className="flex-1"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
          >
            Дальше
          </Button>
        ) : (
          <>
            <Button type="submit" name="publish" value="0" variant="secondary" disabled={pending}>
              Черновик
            </Button>
            <Button type="submit" name="publish" value="1" className="flex-1" disabled={pending}>
              {pending ? 'Сохраняем…' : 'Опубликовать'}
            </Button>
          </>
        )}
      </div>
    </form>
  )
}

function ListEditor({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(event) => {
              const next = [...items]
              next[index] = event.target.value
              onChange(next)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(items.filter((_, position) => position !== index))}
            aria-label={`Удалить пункт ${index + 1}`}
          >
            Удалить
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...items, ''])}>
        Добавить
      </Button>
    </div>
  )
}
