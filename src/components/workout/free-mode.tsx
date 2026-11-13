'use client'

import { SwapButton } from './swap-button'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExerciseLogger } from './exercise-logger'
import { FeelingPicker, type Feeling } from './feeling-picker'
import { HowToButton, HowToDialog } from './how-to'
import { RecommendationCard } from './recommendation-card'
import { RestTimer } from './rest-timer'
import { formatScheme } from '@/shared/scheme'
import { formatWeight } from '@/modules/progression'

export type WorkoutExercise = {
  programExerciseId: string
  exerciseId: string
  name: string
  machineName: string | null
  sets: number
  repMin: number
  repMax: number
  restSec: number
  loadType: 'external' | 'bodyweight' | 'bodyweight_plus'
  stepKg: number
  posterUrl: string | null
  videoMp4Url: string | null
  videoWebmUrl: string | null
  recommendation: { action: string; weightKg: number | null; text: string } | null
  startWeightKg: number
  /** План тренера из программы (вес по анкете). `null` — вес не задан. */
  planWeightKg: number | null
  /** Для окна «Как делать»: slug карточки, шаги, ошибки и совет. */
  slug: string
  steps: string[]
  mistakes: string[]
  tips: string | null
  history: { date: string; sets: { weightKg: number; reps: number; feeling: Feeling | null }[] }[]
}

/** «В следующий раз» после упражнения: считается по текущим подходам и ощущению. */
export type NextRecommendation = {
  text: string
  weightKg: number | null
  action: 'increase' | 'keep' | 'decrease' | 'none'
}

export type LoggedSet = { index: number; weightKg: number; reps: number }
/** Ссылка «Почему?»: вопрос в чат МаксИИма (этап 4). */
function whyHref(exercise: WorkoutExercise, weightKg: number | null): string | undefined {
  if (weightKg === null) return undefined
  const question = `Почему мне рекомендуют ${formatWeight(weightKg)} на „${exercise.name}“?`
  return `/coach?question=${encodeURIComponent(question)}`
}

type Props = {
  exercises: WorkoutExercise[]
  logged: Record<string, LoggedSet[]>
  onLog: (exercise: WorkoutExercise, weightKg: number, reps: number) => void
  onFeeling: (exercise: WorkoutExercise, feeling: Feeling) => void
  onNextWeight: (exercise: WorkoutExercise, weightKg: number) => void | Promise<void>
  nextRecommendations: Record<string, NextRecommendation>
  /** Можно ли заменить упражнение (есть запасные и подходы ещё не записаны). */
  canSwap?: (exercise: WorkoutExercise) => boolean
  onSwap?: (exercise: WorkoutExercise) => void
}

/** Свободный режим: список карточек, активная раскрывается (DESIGN.md §8.3). */
export function FreeMode({
  exercises,
  logged,
  onLog,
  onFeeling,
  onNextWeight,
  nextRecommendations,
  canSwap,
  onSwap,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(exercises[0]?.programExerciseId ?? null)
  /** Открытая карточка «Как делать»: техника без ухода со страницы тренировки. */
  const [howTo, setHowTo] = useState<WorkoutExercise | null>(null)
  /** Отдых после подхода: таймер показывается под логгером, пока не истечёт или не пропущен. */
  const [resting, setResting] = useState<{ id: string; run: number } | null>(null)

  /** После решения про вес открываем следующее незавершённое упражнение. */
  function advanceFrom(exercise: WorkoutExercise): void {
    const index = exercises.findIndex((item) => item.programExerciseId === exercise.programExerciseId)
    const next = exercises
      .slice(index + 1)
      .find((item) => (logged[item.programExerciseId]?.length ?? 0) < item.sets)

    window.setTimeout(() => setActiveId(next ? next.programExerciseId : null), 900)
  }

  return (
    <div className="flex flex-col gap-3">
      {exercises.map((exercise) => {
        const done = logged[exercise.programExerciseId] ?? []
        const complete = done.length >= exercise.sets
        const isActive = activeId === exercise.programExerciseId

        return (
          <div
            key={exercise.programExerciseId}
            className={`flex flex-col gap-3 rounded-card border bg-surface-1 px-3 py-3 ${
              complete ? 'border-success/40 opacity-80' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveId(isActive ? null : exercise.programExerciseId)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
              {exercise.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка
                <img
                  src={exercise.posterUrl}
                  alt=""
                  width={62}
                  height={62}
                  className="h-[62px] w-[62px] rounded-[14px] object-cover"
                />
              ) : (
                <div className="h-[62px] w-[62px] rounded-[14px] bg-surface-2" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[17px]">
                  {complete ? '✓ ' : ''}
                  {exercise.name}
                </span>
                <span className="text-[13px] text-text-muted">
                  {formatScheme(exercise.sets, exercise.repMin, exercise.repMax, exercise.restSec)}
                  {exercise.loadType === 'bodyweight'
                    ? ' · свой вес'
                    : exercise.planWeightKg
                      ? ` · план ${formatWeight(exercise.planWeightKg)}`
                      : ''}
                </span>
                {exercise.recommendation ? (
                  <span className="truncate text-[13px] text-text-secondary">
                    {exercise.recommendation.text}
                  </span>
                ) : null}
              </div>
              </button>

              {/* Технику можно посмотреть сразу, не раскрывая карточку. */}
              <HowToButton
                compact
                label={`Как делать: ${exercise.name}`}
                onClick={() => setHowTo(exercise)}
              />
            </div>

            {isActive && !complete ? (
              <div className="flex flex-col gap-3">
                {exercise.videoMp4Url ? (
                  <button
                    type="button"
                    onClick={() => setHowTo(exercise)}
                    aria-label={`Как делать: ${exercise.name}`}
                    className="relative block w-full overflow-hidden rounded-card"
                  >
                    <video
                      className="aspect-[5/4] w-full object-cover"
                      src={exercise.videoMp4Url}
                      poster={exercise.posterUrl ?? undefined}
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-3 py-1 text-[12px] text-white">
                      Как делать
                    </span>
                  </button>
                ) : null}

                {onSwap && canSwap?.(exercise) ? <SwapButton onClick={() => onSwap(exercise)} /> : null}

                {done.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {done.map((set) => (
                      <span
                        key={set.index}
                        className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-text-secondary"
                      >
                        {set.index}: {exercise.loadType === 'bodyweight' || set.weightKg === 0 ? '' : `${formatWeight(set.weightKg)} · `}{set.reps} раз
                      </span>
                    ))}
                  </div>
                ) : null}

                <ExerciseLogger
                  setNumber={done.length + 1}
                  stepKg={exercise.stepKg}
                  initialWeightKg={done.at(-1)?.weightKg ?? exercise.startWeightKg}
                  initialReps={done.at(-1)?.reps ?? exercise.repMax}
                  onLog={(weightKg, reps) => {
                    onLog(exercise, weightKg, reps)
                    if (done.length + 1 < exercise.sets && exercise.restSec > 0) {
                      setResting({ id: exercise.programExerciseId, run: Date.now() })
                    }
                  }}
                  loadType={exercise.loadType}
                />

                {resting?.id === exercise.programExerciseId ? (
                  <RestTimer
                    key={resting.run}
                    compact
                    seconds={exercise.restSec}
                    onDone={() => setResting(null)}
                    onSkip={() => setResting(null)}
                  />
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <HowToButton onClick={() => setHowTo(exercise)} />
                  <Button type="button" variant="ghost" onClick={() => setActiveId(null)}>
                    Свернуть
                  </Button>
                </div>
              </div>
            ) : null}

            {isActive && complete ? (
              <div className="flex flex-col gap-3">
                <FeelingPicker onPick={(feeling) => onFeeling(exercise, feeling)} />
                {nextRecommendations[exercise.programExerciseId] ? (
                  <RecommendationCard
                    text={nextRecommendations[exercise.programExerciseId]!.text}
                    weightKg={nextRecommendations[exercise.programExerciseId]!.weightKg}
                    action={nextRecommendations[exercise.programExerciseId]!.action}
                    whyHref={whyHref(exercise, nextRecommendations[exercise.programExerciseId]!.weightKg)}
                    onAccept={async () => {
                      await onNextWeight(
                        exercise,
                        nextRecommendations[exercise.programExerciseId]?.weightKg ??
                          done.at(-1)?.weightKg ??
                          exercise.startWeightKg,
                      )
                      advanceFrom(exercise)
                    }}
                    onKeep={async () => {
                      await onNextWeight(exercise, done.at(-1)?.weightKg ?? exercise.startWeightKg)
                      advanceFrom(exercise)
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}

      <HowToDialog
        exercise={howTo}
        open={howTo !== null}
        onOpenChange={(open) => {
          if (!open) setHowTo(null)
        }}
      />
    </div>
  )
}