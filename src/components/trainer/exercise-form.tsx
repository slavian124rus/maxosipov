'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { MuscleState } from '@/components/muscle-figure/state'
import { useChunkedUpload } from '@/components/upload/use-chunked-upload'
import {
  MachinePanel,
  MusclesPanel,
  TextPanel,
  VideoPanel,
  type MachineChoice,
} from '@/components/trainer/exercise-panels'
import { muscleName, type MuscleCode } from '@/shared/muscles'
import type { ExerciseDetail } from '@/modules/catalog'
import {
  saveExerciseAction,
  draftExerciseAction,
  type SaveExerciseState,
} from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: SaveExerciseState = { error: null, id: null }
const TOTAL_STEPS = 5

type Props = {
  machines: MachineChoice[]
  initial?: ExerciseDetail | null
}

/**
 * Мастер нового упражнения (DESIGN.md §8.9): видео → тренажёр → мышцы → описание → проверка.
 * Правка уже добавленного упражнения идёт не по шагам, а вкладочным окном
 * (`ExerciseEditor`) — проходить мастер заново не нужно.
 */
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
  const [overlayProfile, setOverlayProfile] = useState<string>(initial?.overlayProfile ?? 'none')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  async function uploadVideo(file: File): Promise<void> {
    setVideoFile(file)
    const id = await upload.upload(file, 'exercise_video')
    if (id) setVideoMediaId(id)
  }

  /** «Черновик от МаксИИма»: заполняет шаги, ошибки и совет, Максим правит. */
  async function createDraft(): Promise<void> {
    setDrafting(true)
    setDraftError(null)

    try {
      const result = await draftExerciseAction({
        name,
        machine: machines.find((machine) => machine.id === machineId)?.name ?? null,
        primary: muscles.primary,
        secondary: muscles.secondary,
      })

      if (result.error) {
        setDraftError(result.error)
        return
      }

      if (result.draft) {
        setSteps(result.draft.steps.length > 0 ? result.draft.steps : [''])
        setMistakes(result.draft.mistakes.length > 0 ? result.draft.mistakes : [''])
        setTips(result.draft.tip)
      }
    } finally {
      setDrafting(false)
    }
  }

  const canNext = ((): boolean => {
    // Видео необязательно: без него в карточке показывается фото тренажёра («Видео скоро»).
    if (step === 0) return !upload.uploading
    if (step === 1) return machineId !== ''
    if (step === 2) return muscles.primary.length > 0
    if (step === 3) return name.trim().length >= 2 && steps.some((item) => item.trim())
    return true
  })()


  return (
    <form
      action={formAction}
      className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-4 py-6 lg:py-8"
    >
      <input type="hidden" name="id" value={initial?.id ?? ''} />
      <input
        type="hidden"
        name="videoMediaId"
        value={videoMediaId === 'existing' ? '' : (videoMediaId ?? '')}
      />
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="primary" value={muscles.primary.join(',')} />
      <input type="hidden" name="secondary" value={muscles.secondary.join(',')} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="repMin" value={repMin} />
      <input type="hidden" name="repMax" value={repMax} />
      <input type="hidden" name="steps" value={JSON.stringify(steps.filter((item) => item.trim()))} />
      <input
        type="hidden"
        name="mistakes"
        value={JSON.stringify(mistakes.filter((item) => item.trim()))}
      />
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
            <VideoPanel
              upload={upload}
              videoFile={videoFile}
              videoMediaId={videoMediaId}
              cropX={cropX}
              onUpload={(file) => void uploadVideo(file)}
              onCropChange={setCropX}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="text-[22px] font-semibold">Тренажёр</h1>
            <MachinePanel machines={machines} machineId={machineId} onChange={setMachineId} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-[22px] font-semibold">Мышцы</h1>
            <MusclesPanel
              muscles={muscles}
              onChange={setMuscles}
              overlayProfile={overlayProfile}
              onOverlayChange={setOverlayProfile}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-[22px] font-semibold">Описание</h1>
            <TextPanel
              name={name}
              onName={setName}
              repMin={repMin}
              repMax={repMax}
              onRepMin={setRepMin}
              onRepMax={setRepMax}
              steps={steps}
              onSteps={setSteps}
              mistakes={mistakes}
              onMistakes={setMistakes}
              tips={tips}
              onTips={setTips}
              onDraft={() => void createDraft()}
              drafting={drafting}
              draftError={draftError}
            />
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
                {videoMediaId ? 'Видео загружено' : 'Без видео — в карточке будет фото тренажёра'}
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
            {step === 0 && !videoMediaId ? 'Пропустить' : 'Дальше'}
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
