'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getOfflineDb } from '@/lib/offline/db'
import { useActiveSession } from '@/lib/offline/use-active-session'
import { useProgramVersion } from '@/lib/use-program-version'
import { recommend, recommendationText, type ProgressionRules } from '@/modules/progression'
import type { VoiceRow } from '@/modules/coach-ai'
import { FreeMode, type LoggedSet, type NextRecommendation, type WorkoutExercise } from './free-mode'
import { GuidedMode } from './guided-mode'
import { FinishSummary } from './finish-summary'
import { ProgramUpdateBanner } from './program-update-banner'
import { VoiceLog } from './voice-log'
import type { Feeling } from './feeling-picker'

type Props = {
  programId: string
  programDayId: string | null
  dayName: string
  mode: 'free' | 'guided'
  exercises: WorkoutExercise[]
  rules: ProgressionRules
}

/** Оболочка тренировки: старт сессии, запись подходов, завершение. */
export function WorkoutClient({ programId, programDayId, dayName, mode, exercises, rules }: Props) {
  const session = useActiveSession()
  const [logged, setLogged] = useState<Record<string, LoggedSet[]>>({})
  const [finished, setFinished] = useState<{
    durationMin: number
    volumeKg: number
    count: number
    sessionClientUuid: string | null
  } | null>(null)
  const router = useRouter()
  const startedRef = useRef(false)
  const loggedRef = useRef<Record<string, LoggedSet[]>>({})
  const [storageFailed, setStorageFailed] = useState(false)
  const [nextRecommendations, setNextRecommendations] = useState<Record<string, NextRecommendation>>({})
  const programUpdated = useProgramVersion(programId)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function boot(): Promise<void> {
      try {
        // Продолжаем незавершённую тренировку (в том числе после закрытия приложения офлайн)
        // или начинаем новую; решение — по данным IndexedDB.
        const active = await session.startOrResume({ programDayId, mode, programSnapshot: exercises })

        const rows = await (await getOfflineDb()).sets
          .where('sessionClientUuid')
          .equals(active.clientUuid)
          .toArray()

        // подходы хранятся по `exerciseId`, экран ведёт учёт по карточкам (`programExerciseId`)
        const cardByExercise = new Map(exercises.map((item) => [item.exerciseId, item.programExerciseId]))
        const restored: Record<string, LoggedSet[]> = {}

        for (const row of rows.sort((a, b) => a.setIndex - b.setIndex)) {
          const key = cardByExercise.get(row.exerciseId)
          if (!key) continue
          const list = restored[key] ?? []
          list.push({ index: row.setIndex, weightKg: row.weightKg, reps: row.reps })
          restored[key] = list
        }

        loggedRef.current = restored
        setLogged(restored)
      } catch (error) {
        console.error('[offline] не удалось открыть локальную базу', error)
        setStorageFailed(true)
      }
    }

    void boot()
    void session.precacheMedia(
      exercises.flatMap((item) => [item.videoMp4Url, item.posterUrl].filter((url): url is string => !!url)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- старт нужен один раз
  }, [])

  /**
   * Подход появляется на экране только после записи в IndexedDB: что видно — то и сохранено
   * (иначе мгновенная перезагрузка потеряла бы «показанный» подход). Актуальный список держим
   * в ref, чтобы быстрые повторные нажатия получали правильные номера подходов.
   */
  function log(exercise: WorkoutExercise, weightKg: number, reps: number): void {
    const key = exercise.programExerciseId
    const list = loggedRef.current[key] ?? []
    const next = [...list, { index: list.length + 1, weightKg, reps }]
    loggedRef.current = { ...loggedRef.current, [key]: next }

    void session
      .logSet({ exerciseId: exercise.exerciseId, setIndex: next.length, weightKg, reps })
      .then(() => setLogged(loggedRef.current))
      .catch((error: unknown) => {
        console.error('[offline] подход не сохранён', error)
        loggedRef.current = { ...loggedRef.current, [key]: list }
        setStorageFailed(true)
      })
  }

  function feel(exercise: WorkoutExercise, feeling: Feeling): void {
    void session.setFeeling(exercise.exerciseId, feeling)

    // «В следующий раз»: сегодняшние подходы с выбранным ощущением + завершённые тренировки
    const today = (loggedRef.current[exercise.programExerciseId] ?? []).map((set) => ({
      weightKg: set.weightKg,
      reps: set.reps,
      feeling,
    }))
    const recommendation = recommend(
      {
        target: { sets: exercise.sets, repMin: exercise.repMin, repMax: exercise.repMax },
        stepKg: exercise.stepKg,
        history: [
          { date: new Date(), sets: today },
          ...exercise.history.map((item) => ({ date: new Date(item.date), sets: item.sets })),
        ],
      },
      rules,
    )

    setNextRecommendations((current) => ({
      ...current,
      [exercise.programExerciseId]: {
        weightKg: recommendation.weightKg,
        action: recommendation.action,
        text: recommendationText(recommendation, { repMax: exercise.repMax }),
      },
    }))
  }

  function nextWeight(exercise: WorkoutExercise, weightKg: number): void {
    void fetch('/api/training/next-weight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exerciseId: exercise.exerciseId, weightKg }),
    }).catch(() => undefined) // офлайн: вес на следующий раз не критичен
  }

  async function finish(): Promise<void> {
    const startedAt = session.session?.startedAt ?? new Date().toISOString()
    const sessionClientUuid = session.session?.clientUuid ?? null
    const durationMin = Math.max(
      1,
      Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
    )
    const volumeKg = Object.values(logged)
      .flat()
      .reduce((sum, set) => sum + set.weightKg * set.reps, 0)

    await session.finish()
    setFinished({
      durationMin,
      volumeKg: Math.round(volumeKg),
      count: Object.values(logged).filter((sets) => sets.length > 0).length,
      sessionClientUuid,
    })
  }

  async function saveVoiceRows(rows: VoiceRow[]): Promise<void> {
    const counts = new Map<string, number>()

    for (const item of exercises) {
      counts.set(item.exerciseId, loggedRef.current[item.programExerciseId]?.length ?? 0)
    }

    for (const row of rows) {
      if (!row.exerciseId) continue

      let index = counts.get(row.exerciseId) ?? 0
      const card = exercises.find((item) => item.exerciseId === row.exerciseId)
      const list = card ? [...(loggedRef.current[card.programExerciseId] ?? [])] : []

      for (const set of row.sets) {
        index += 1
        await session.logSet({
          exerciseId: row.exerciseId,
          setIndex: index,
          weightKg: set.weightKg,
          reps: set.reps,
        })
        list.push({ index, weightKg: set.weightKg, reps: set.reps })
      }

      counts.set(row.exerciseId, index)
      if (row.feeling) await session.setFeeling(row.exerciseId, row.feeling)

      if (card) {
        loggedRef.current = { ...loggedRef.current, [card.programExerciseId]: list }
        setLogged(loggedRef.current)
      }
    }
  }

  if (finished) {
    return (
      <div className="px-4 py-6">
        <FinishSummary
          durationMin={finished.durationMin}
          exerciseCount={finished.count}
          volumeKg={finished.volumeKg}
          sessionClientUuid={finished.sessionClientUuid}
          exercises={exercises.map((item) => ({ id: item.exerciseId, name: item.name }))}
          onClose={() => router.push('/')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-semibold">Тренировка · {dayName}</h1>
        <div className="flex items-center gap-2">
          {session.pending > 0 ? (
            <span className="text-[13px] text-warning">Не отправлено: {session.pending}</span>
          ) : null}
          {session.session ? (
            <VoiceLog
              compact
              sessionClientUuid={session.session.clientUuid}
              exercises={exercises.map((item) => ({ id: item.exerciseId, name: item.name }))}
              onSave={saveVoiceRows}
            />
          ) : null}
        </div>
      </header>

      {storageFailed ? (
        <p className="rounded-card border border-warning/40 px-3 py-2 text-[13px] text-warning">
          Не удалось открыть память устройства: подходы не сохранятся без сети. Обнови страницу.
        </p>
      ) : null}

      {programUpdated ? (
        <ProgramUpdateBanner
          onRefresh={() => {
            // Записанные подходы лежат в IndexedDB — перерисовка их не теряет.
            router.refresh()
          }}
        />
      ) : null}

      {mode === 'guided' ? (
        <GuidedMode
          exercises={exercises}
          logged={logged}
          onLog={log}
          onFeeling={feel}
          onNextWeight={nextWeight}
          nextRecommendations={nextRecommendations}
        />
      ) : (
        <FreeMode
          exercises={exercises}
          logged={logged}
          onLog={log}
          onFeeling={feel}
          onNextWeight={nextWeight}
          nextRecommendations={nextRecommendations}
        />
      )}

      <Button type="button" variant="secondary" onClick={() => void finish()}>
        Завершить тренировку
      </Button>
    </div>
  )
}