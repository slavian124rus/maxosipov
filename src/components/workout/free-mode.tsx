'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExerciseLogger } from './exercise-logger'
import { FeelingPicker, type Feeling } from './feeling-picker'
import { RecommendationCard } from './recommendation-card'
import { formatScheme } from '@/shared/scheme'

export type WorkoutExercise = {
  programExerciseId: string
  exerciseId: string
  name: string
  machineName: string | null
  sets: number
  repMin: number
  repMax: number
  restSec: number
  stepKg: number
  posterUrl: string | null
  videoMp4Url: string | null
  videoWebmUrl: string | null
  recommendation: { action: string; weightKg: number | null; text: string } | null
  startWeightKg: number
}

export type LoggedSet = { index: number; weightKg: number; reps: number }

type Props = {
  exercises: WorkoutExercise[]
  logged: Record<string, LoggedSet[]>
  onLog: (exercise: WorkoutExercise, weightKg: number, reps: number) => void
  onFeeling: (exercise: WorkoutExercise, feeling: Feeling) => void
  onNextWeight: (exercise: WorkoutExercise, weightKg: number) => void
}

/** Свободный режим: список карточек, активная раскрывается (DESIGN.md §8.3). */
export function FreeMode({ exercises, logged, onLog, onFeeling, onNextWeight }: Props) {
  const [activeId, setActiveId] = useState<string | null>(exercises[0]?.programExerciseId ?? null)

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
            <button
              type="button"
              onClick={() => setActiveId(isActive ? null : exercise.programExerciseId)}
              className="flex items-center gap-3 text-left"
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
                  {formatScheme(exercise.sets, exercise.repMin, exercise.repMax)}
                </span>
                {exercise.recommendation ? (
                  <span className="truncate text-[13px] text-text-secondary">
                    {exercise.recommendation.text}
                  </span>
                ) : null}
              </div>
            </button>

            {isActive && !complete ? (
              <div className="flex flex-col gap-3">
                {exercise.videoMp4Url ? (
                  <video
                    className="aspect-[5/4] w-full rounded-card object-cover"
                    src={exercise.videoMp4Url}
                    poster={exercise.posterUrl ?? undefined}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : null}

                {done.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {done.map((set) => (
                      <span
                        key={set.index}
                        className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-text-secondary"
                      >
                        {set.index}: {set.weightKg} кг · {set.reps} раз
                      </span>
                    ))}
                  </div>
                ) : null}

                <ExerciseLogger
                  setNumber={done.length + 1}
                  stepKg={exercise.stepKg}
                  initialWeightKg={done.at(-1)?.weightKg ?? exercise.startWeightKg}
                  initialReps={done.at(-1)?.reps ?? exercise.repMax}
                  onLog={(weightKg, reps) => onLog(exercise, weightKg, reps)}
                />

                <Button type="button" variant="ghost" onClick={() => setActiveId(null)}>
                  Свернуть
                </Button>
              </div>
            ) : null}

            {isActive && complete ? (
              <div className="flex flex-col gap-3">
                <FeelingPicker onPick={(feeling) => onFeeling(exercise, feeling)} />
                {exercise.recommendation ? (
                  <RecommendationCard
                    text={exercise.recommendation.text}
                    weightKg={exercise.recommendation.weightKg}
                    onAccept={() =>
                      onNextWeight(
                        exercise,
                        exercise.recommendation?.weightKg ?? exercise.startWeightKg,
                      )
                    }
                    onKeep={() => onNextWeight(exercise, done.at(-1)?.weightKg ?? exercise.startWeightKg)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}