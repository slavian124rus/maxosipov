'use client'

import { SwapButton } from './swap-button'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExerciseLogger } from './exercise-logger'
import { FeelingPicker, type Feeling } from './feeling-picker'
import { RecommendationCard } from './recommendation-card'
import { HowToButton, HowToDialog } from './how-to'
import { RestTimer } from './rest-timer'
import { formatScheme } from '@/shared/scheme'
import { formatWeight } from '@/modules/progression'
import type { LoggedSet, NextRecommendation, WorkoutExercise } from './free-mode'
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

/** Пошаговый режим: одно упражнение на экран, таймер отдыха (DESIGN.md §8.4). */
export function GuidedMode({
  exercises,
  logged,
  onLog,
  onFeeling,
  onNextWeight,
  nextRecommendations,
  canSwap,
  onSwap,
}: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'logging' | 'rest'>('idle')
  /** Открытая карточка «Как делать» — техника, не выходя из пошагового режима. */
  const [howTo, setHowTo] = useState<WorkoutExercise | null>(null)

  const exercise = exercises[index]
  if (!exercise) return <p className="text-[15px] text-text-secondary">Упражнений нет</p>

  const done = logged[exercise.programExerciseId] ?? []
  const complete = done.length >= exercise.sets
  const isLast = index === exercises.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-[13px] text-text-muted">
        <span>
          {index + 1} из {exercises.length}
        </span>
        <span>
          {formatScheme(exercise.sets, exercise.repMin, exercise.repMax)}
          {exercise.planWeightKg ? ` · план ${formatWeight(exercise.planWeightKg)}` : ''}
        </span>
      </div>

      {exercise.videoMp4Url ? (
        <video
          className="mx-auto aspect-[4/5] max-h-[45vh] w-full rounded-card bg-black object-cover"
          src={exercise.videoMp4Url}
          poster={exercise.posterUrl ?? undefined}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          onClick={(event) => {
            const video = event.currentTarget
            if (video.paused) void video.play()
            else video.pause()
          }}
        />
      ) : null}

      <h2 className="font-display text-[34px] leading-none">{exercise.name}</h2>

      <div className="flex flex-wrap gap-2">
        <HowToButton onClick={() => setHowTo(exercise)} />
      </div>
      {onSwap && canSwap?.(exercise) ? <SwapButton onClick={() => onSwap(exercise)} /> : null}

      {exercise.recommendation ? (
        <p className="text-[15px] text-text-secondary">{exercise.recommendation.text}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {done.map((set) => (
          <span
            key={set.index}
            className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-text-secondary"
          >
            {set.index}: {formatWeight(set.weightKg)} · {set.reps} раз
          </span>
        ))}
      </div>

      {!complete && phase === 'idle' ? (
        <Button type="button" onClick={() => setPhase('logging')}>
          Старт подхода
        </Button>
      ) : null}

      {!complete && phase === 'logging' ? (
        <ExerciseLogger
          setNumber={done.length + 1}
          stepKg={exercise.stepKg}
          initialWeightKg={done.at(-1)?.weightKg ?? exercise.startWeightKg}
          initialReps={done.at(-1)?.reps ?? exercise.repMax}
          loadType={exercise.loadType}
          onLog={(weightKg, reps) => {
            onLog(exercise, weightKg, reps)
            setPhase('rest')
          }}
        />
      ) : null}

      {!complete && phase === 'rest' ? (
        <RestTimer
          seconds={exercise.restSec}
          onDone={() => setPhase('idle')}
          onSkip={() => setPhase('idle')}
        />
      ) : null}

      {complete ? (
        <div className="flex flex-col gap-3">
          <FeelingPicker onPick={(feeling) => onFeeling(exercise, feeling)} />
          {nextRecommendations[exercise.programExerciseId] ? (
            <RecommendationCard
              text={nextRecommendations[exercise.programExerciseId]!.text}
              weightKg={nextRecommendations[exercise.programExerciseId]!.weightKg}
              action={nextRecommendations[exercise.programExerciseId]!.action}
              whyHref={whyHref(exercise, nextRecommendations[exercise.programExerciseId]!.weightKg)}
              onAccept={() =>
                onNextWeight(
                  exercise,
                  nextRecommendations[exercise.programExerciseId]?.weightKg ??
                    done.at(-1)?.weightKg ??
                    exercise.startWeightKg,
                )
              }
              onKeep={() => onNextWeight(exercise, done.at(-1)?.weightKg ?? exercise.startWeightKg)}
            />
          ) : null}
          {!isLast ? (
            <Button
              type="button"
              onClick={() => {
                setIndex(index + 1)
                setPhase('idle')
              }}
            >
              Дальше
            </Button>
          ) : (
            <p className="text-[13px] text-text-muted">Это последнее упражнение — заверши тренировку</p>
          )}
        </div>
      ) : null}

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