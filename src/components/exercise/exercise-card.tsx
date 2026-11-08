'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExerciseVideo } from '@/components/exercise/exercise-video'
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure'
import { muscleName, type MuscleCode } from '@/shared/muscles'
import type { ExerciseDetail } from '@/modules/catalog'

const PROFILE_LABEL: Record<string, string> = {
  pull_vertical: 'Тяга сверху',
  pull_horizontal: 'Тяга горизонтальная',
  none: 'Без подсветки',
}

/** Карточка упражнения (DESIGN.md §8.2). */
export function ExerciseCard({ exercise }: { exercise: ExerciseDetail }) {
  const [flash, setFlash] = useState<MuscleCode | null>(null)

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 1200)
    return () => clearTimeout(timer)
  }, [flash])

  const primary = exercise.primaryMuscles as MuscleCode[]
  const secondary = exercise.secondaryMuscles as MuscleCode[]

  return (
    <div className="flex flex-col gap-5 pb-24">
      <ExerciseVideo
        mp4={exercise.videoMp4Url}
        webm={exercise.videoWebmUrl}
        musclesMp4={exercise.musclesMp4Url}
        poster={exercise.posterUrl}
        name={exercise.name}
      />

      <div className="flex flex-col gap-2 px-4">
        <h1 className="font-display text-[34px] leading-none font-medium">{exercise.name}</h1>
        <div className="flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-text-secondary">
            {exercise.machineName ?? 'Свободные веса'}
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-text-secondary">
            {exercise.defaultRepMin}–{exercise.defaultRepMax} раз
          </span>
          {exercise.hasMuscles ? (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-text-secondary">
              {PROFILE_LABEL[exercise.overlayProfile] ?? exercise.overlayProfile}
            </span>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3 px-4">
        <h2 className="text-[22px] font-semibold">Какие мышцы работают</h2>
        <MuscleFigure primary={flash ? [flash] : primary} secondary={secondary} size="md" />

        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-muted">Основные</p>
          <div className="flex flex-wrap gap-2">
            {primary.length === 0 ? (
              <span className="text-[15px] text-text-secondary">Не отмечены</span>
            ) : (
              primary.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFlash(code)}
                  className="rounded-full bg-surface-2 px-3 py-1 text-[15px] text-text"
                >
                  {muscleName(code)}
                </button>
              ))
            )}
          </div>
        </div>

        {secondary.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">Помогают</p>
            <div className="flex flex-wrap gap-2">
              {secondary.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFlash(code)}
                  className="rounded-full border border-border px-3 py-1 text-[15px] text-text-secondary"
                >
                  {muscleName(code)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 px-4">
        <h2 className="text-[22px] font-semibold">Как делать</h2>
        <ol className="flex flex-col gap-2">
          {exercise.steps.map((step, index) => (
            <li key={`${index}-${step}`} className="flex gap-3">
              <span className="font-display text-[20px] text-accent">{index + 1}</span>
              <span className="text-[15px] text-text-secondary">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {exercise.mistakes.length > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <h2 className="text-[22px] font-semibold">Частые ошибки</h2>
          <ul className="flex flex-col gap-2">
            {exercise.mistakes.map((mistake) => (
              <li key={mistake} className="text-[15px] text-text-secondary">
                {mistake}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {exercise.tips ? (
        <section className="px-4">
          <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-text-secondary">
            {exercise.tips}
          </p>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[480px] gap-2 border-t border-border bg-surface-1 px-4 py-3">
        <Link
          href={`/coach?exercise=${exercise.slug}`}
          className="flex h-12 flex-1 items-center justify-center rounded-control bg-accent text-[15px] text-white"
        >
          Спросить МаксИИма
        </Link>
        <button
          type="button"
          disabled
          className="h-12 flex-1 rounded-control border border-border text-[15px] text-text-muted"
        >
          В тренировку
        </button>
      </div>
    </div>
  )
}
