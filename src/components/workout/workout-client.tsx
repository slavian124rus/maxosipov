'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getOfflineDb } from '@/lib/offline/db'
import { useActiveSession } from '@/lib/offline/use-active-session'
import { FreeMode, type LoggedSet, type WorkoutExercise } from './free-mode'
import { GuidedMode } from './guided-mode'
import { FinishSummary } from './finish-summary'
import type { Feeling } from './feeling-picker'

type Props = {
  programDayId: string | null
  dayName: string
  mode: 'free' | 'guided'
  exercises: WorkoutExercise[]
}

/** Оболочка тренировки: старт сессии, запись подходов, завершение. */
export function WorkoutClient({ programDayId, dayName, mode, exercises }: Props) {
  const session = useActiveSession()
  const [logged, setLogged] = useState<Record<string, LoggedSet[]>>({})
  const [finished, setFinished] = useState<{
    durationMin: number
    volumeKg: number
    count: number
  } | null>(null)
  const router = useRouter()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function boot(): Promise<void> {
      if (!session.session) {
        await session.start({ programDayId, mode, programSnapshot: exercises })
      }

      // Восстанавливаем записанные подходы после перезагрузки (в том числе офлайн).
      const active = await (await getOfflineDb()).activeSession.toCollection().first()
      if (!active) return

      const rows = await (await getOfflineDb()).sets.where('sessionClientUuid').equals(active.clientUuid).toArray()
      const restored: Record<string, LoggedSet[]> = {}

      for (const row of rows) {
        const list = restored[row.exerciseId] ?? []
        list.push({ index: row.setIndex, weightKg: row.weightKg, reps: row.reps })
        restored[row.exerciseId] = list
      }

      setLogged(restored)
    }

    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- старт нужен один раз
  }, [])

  function log(exercise: WorkoutExercise, weightKg: number, reps: number): void {
    const list = logged[exercise.exerciseId] ?? []
    const next = [...list, { index: list.length + 1, weightKg, reps }]
    setLogged({ ...logged, [exercise.exerciseId]: next })

    void session.logSet({
      exerciseId: exercise.exerciseId,
      setIndex: next.length,
      weightKg,
      reps,
    })
  }

  function feel(exercise: WorkoutExercise, feeling: Feeling): void {
    void session.setFeeling(exercise.exerciseId, feeling)
  }

  function nextWeight(exercise: WorkoutExercise, weightKg: number): void {
    void fetch('/api/training/next-weight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exerciseId: exercise.exerciseId, weightKg }),
    })
  }

  async function finish(): Promise<void> {
    const startedAt = session.session?.startedAt ?? new Date().toISOString()
    const durationMin = Math.max(
      1,
      Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
    )
    const volumeKg = Object.values(logged)
      .flat()
      .reduce((sum, set) => sum + set.weightKg * set.reps, 0)

    await session.finish()
    setFinished({ durationMin, volumeKg: Math.round(volumeKg), count: Object.keys(logged).length })
  }

  if (finished) {
    return (
      <div className="px-4 py-6">
        <FinishSummary
          durationMin={finished.durationMin}
          exerciseCount={finished.count}
          volumeKg={finished.volumeKg}
          onClose={() => router.push('/')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-semibold">Тренировка · {dayName}</h1>
        {session.pending > 0 ? (
          <span className="text-[13px] text-warning">Не отправлено: {session.pending}</span>
        ) : null}
      </header>

      {mode === 'guided' ? (
        <GuidedMode
          exercises={exercises}
          logged={logged}
          onLog={log}
          onFeeling={feel}
          onNextWeight={nextWeight}
        />
      ) : (
        <FreeMode
          exercises={exercises}
          logged={logged}
          onLog={log}
          onFeeling={feel}
          onNextWeight={nextWeight}
        />
      )}

      <Button type="button" variant="secondary" onClick={() => void finish()}>
        Завершить тренировку
      </Button>
    </div>
  )
}