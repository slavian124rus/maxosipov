'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
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
  draftExerciseAction,
  reviewExerciseAction,
  saveExerciseAction,
  unpublishAction,
  type ReviewExerciseState,
  type SaveExerciseState,
} from '@/app/(app)/app/trainer/exercises/actions'
import { DeleteExercise } from '@/components/trainer/delete-exercise'
import { ExerciseAiPanel } from '@/components/trainer/exercise-ai-panel'

const INITIAL: SaveExerciseState = { error: null, id: null }

const TABS = [
  { id: 'text', label: 'Описание' },
  { id: 'video', label: 'Видео' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'muscles', label: 'Мышцы' },
  { id: 'ai', label: 'МаксИИм' },
  { id: 'publish', label: 'Публикация' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Что мешает публикации — те же условия, что проверяет сервер. */
export function publishChecklist(input: {
  primaryMuscles: number
  steps: number
  hasVideo: boolean
}): { label: string; done: boolean }[] {
  return [
    { label: 'Отмечена хотя бы одна основная мышца', done: input.primaryMuscles > 0 },
    { label: 'Есть хотя бы один шаг «Как делать»', done: input.steps > 0 },
    { label: 'Есть видео или фото тренажёра', done: input.hasVideo },
  ]
}

/**
 * Правка добавленного упражнения вкладочным окном (DESIGN.md §8.9): каждый шаг мастера —
 * отдельная вкладка, можно сразу перейти к нужному полю и сохранить, не проходя мастер заново.
 */
export function ExerciseEditor({
  exercise,
  machines,
  onSaved,
  onDeleted,
}: {
  exercise: ExerciseDetail
  machines: MachineChoice[]
  onSaved?: () => void
  /** Упражнение удалено: окно можно закрыть, дерево обновится. */
  onDeleted?: () => void
}) {
  const [state, formAction, pending] = useActionState(saveExerciseAction, INITIAL)
  const upload = useChunkedUpload()
  const [tab, setTab] = useState<TabId>('text')

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoMediaId, setVideoMediaId] = useState<string | null>(
    exercise.videoMp4Url ? 'existing' : null,
  )
  const [cropX, setCropX] = useState(0.5)
  const [machineId, setMachineId] = useState<string>(exercise.machineId ?? '')
  const [muscles, setMuscles] = useState<MuscleState>({
    primary: exercise.primaryMuscles as MuscleCode[],
    secondary: exercise.secondaryMuscles as MuscleCode[],
  })
  const [name, setName] = useState(exercise.name)
  const [repMin, setRepMin] = useState(String(exercise.defaultRepMin))
  const [repMax, setRepMax] = useState(String(exercise.defaultRepMax))
  const [steps, setSteps] = useState<string[]>(exercise.steps.length > 0 ? exercise.steps : [''])
  const [mistakes, setMistakes] = useState<string[]>(
    exercise.mistakes.length > 0 ? exercise.mistakes : [''],
  )
  const [tips, setTips] = useState(exercise.tips ?? '')
  const [overlayProfile, setOverlayProfile] = useState<string>(exercise.overlayProfile)
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  /** Результат проверки на вкладке «МаксИИм»: замечания и предложенные исправления. */
  const [aiReview, setAiReview] = useState<ReviewExerciseState | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  /** Какая кнопка отправляет форму: от неё зависит текст уведомления. */
  const intent = useRef<'save' | 'publish'>('save')

  // Сохранение удалось — показываем всплывающий алерт вместо строчки под формой.
  useEffect(() => {
    if (!state.id) return

    if (intent.current === 'publish') {
      toast.success('Опубликовано', { description: `${name} — клиенты увидят упражнение` })
    } else {
      toast.success('Сохранено', { description: name })
    }
    // Название в подписи не должно перезапускать эффект — он срабатывает на новый результат.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  const machine = machines.find((item) => item.id === machineId) ?? null
  const checklist = publishChecklist({
    primaryMuscles: muscles.primary.length,
    steps: steps.filter((item) => item.trim()).length,
    hasVideo: Boolean(videoMediaId) || exercise.hasVideo,
  })
  const published = exercise.status === 'published'

  async function uploadVideo(file: File): Promise<void> {
    setVideoFile(file)
    const id = await upload.upload(file, 'exercise_video')
    if (id) setVideoMediaId(id)
  }

  async function createDraft(): Promise<void> {
    setDrafting(true)
    setDraftError(null)

    try {
      const result = await draftExerciseAction({
        name,
        machine: machine?.name ?? null,
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
        setTab('text')
      }
    } finally {
      setDrafting(false)
    }
  }


  /**
   * Проверка карточки на вкладке «МаксИИм»: замечания считаются без ИИ, модель
   * добавляет резюме и исправленные поля. Ничего не сохраняет.
   */
  async function checkWithAi(): Promise<void> {
    setAiLoading(true)

    try {
      const result = await reviewExerciseAction({
        name,
        machine: machine?.name ?? null,
        primary: muscles.primary,
        secondary: muscles.secondary,
        steps,
        mistakes,
        tip: tips.trim() === '' ? null : tips,
        repMin: Number(repMin) || 0,
        repMax: Number(repMax) || 0,
        hasVideo: Boolean(videoMediaId) || exercise.hasVideo,
        hasPhoto: Boolean(exercise.photoUrl || exercise.thumbUrl),
      })

      setAiReview(result)
    } finally {
      setAiLoading(false)
    }
  }

  /** Подставляет предложенные поля в форму: сохранить тренер должен сам. */
  function applyAiFix(): void {
    const fix = aiReview?.review?.fix
    if (!fix) return

    setName(fix.name)
    setRepMin(String(fix.repMin))
    setRepMax(String(fix.repMax))
    setSteps(fix.steps.length > 0 ? fix.steps : [''])
    setMistakes(fix.mistakes.length > 0 ? fix.mistakes : [''])
    setTips(fix.tip)
    setMuscles({ primary: fix.primary as MuscleCode[], secondary: fix.secondary as MuscleCode[] })
    setTab('text')
    toast.success('Поля заполнены', { description: 'Проверь и нажми «Сохранить»' })
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={exercise.id} />
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

      <div
        role="tablist"
        aria-label="Разделы упражнения"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] ${
              tab === item.id
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {tab === 'video' ? (
          <VideoPanel
            upload={upload}
            videoFile={videoFile}
            videoMediaId={videoMediaId}
            cropX={cropX}
            onUpload={(file) => void uploadVideo(file)}
            onCropChange={setCropX}
          />
        ) : null}

        {tab === 'machine' ? (
          <MachinePanel machines={machines} machineId={machineId} onChange={setMachineId} />
        ) : null}

        {tab === 'muscles' ? (
          <MusclesPanel
            muscles={muscles}
            onChange={setMuscles}
            overlayProfile={overlayProfile}
            onOverlayChange={setOverlayProfile}
          />
        ) : null}

        {tab === 'text' ? (
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
        ) : null}

        {tab === 'ai' ? (
          <ExerciseAiPanel
            loading={aiLoading}
            issues={aiReview?.issues ?? []}
            review={aiReview?.review ?? null}
            error={aiReview?.error ?? null}
            onCheck={() => void checkWithAi()}
            onApply={applyAiFix}
          />
        ) : null}

        {tab === 'publish' ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] text-text-secondary">
              Сейчас:{' '}
              <span className={published ? 'text-success' : 'text-warning'}>
                {published ? 'опубликовано, клиенты видят' : 'черновик, клиенты не видят'}
              </span>
            </p>

            <ul className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-[15px]">
                  <span className={item.done ? 'text-success' : 'text-text-muted'}>
                    {item.done ? '✓' : '•'}
                  </span>
                  <span className={item.done ? 'text-text-secondary' : 'text-text-muted'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-[13px] text-text-muted">
              Основные мышцы: {muscles.primary.map(muscleName).join(', ') || 'не отмечены'} ·
              тренажёр: {machine?.name ?? 'без тренажёра'} · {repMin}–{repMax} раз
            </p>
          </div>
        ) : null}
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {state.notice ? <p className="text-[15px] text-text-secondary">{state.notice}</p> : null}

      {/* Футер прозрачный, как сам лист: фон окна просвечивает, ничего не «темнеет» полосой. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border/60 bg-transparent pt-3">
        <Button
          type="submit"
          name="publish"
          value="0"
          disabled={pending || upload.uploading}
          onClick={() => {
            intent.current = 'save'
          }}
        >
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        <Button
          type="submit"
          name="publish"
          value="1"
          variant="secondary"
          disabled={pending || upload.uploading}
          onClick={() => {
            intent.current = 'publish'
          }}
        >
          Опубликовать
        </Button>
        {published ? (
          <Button type="submit" formAction={unpublishAction} variant="ghost">
            Вернуть в черновики
          </Button>
        ) : null}
        {onSaved ? (
          <Button type="button" variant="ghost" onClick={onSaved} className="ml-auto">
            Закрыть
          </Button>
        ) : null}
      </div>

      <DeleteExercise exerciseId={exercise.id} name={name} onDeleted={onDeleted} />
    </form>
  )
}
