'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getOfflineDb } from '@/lib/offline/db'
import { useActiveSession } from '@/lib/offline/use-active-session'
import { useOnline } from '@/lib/use-online'
import { flushPendingNextWeights, postNextWeight } from '@/lib/next-weight-queue'
import { useProgramVersion } from '@/lib/use-program-version'
import {
  recommend,
  recommendBodyweight,
  recommendationText,
  type ProgressionRules,
} from '@/modules/progression'
import type { VoiceRow } from '@/modules/coach-ai'
import { FreeMode, type LoggedSet, type NextRecommendation, type WorkoutExercise } from './free-mode'
import { GuidedMode } from './guided-mode'
import { FinishSummary } from './finish-summary'
import { ProgramUpdateBanner } from './program-update-banner'
import { VoiceLog } from './voice-log'
import { dismissWorkoutNotification, useWorkoutNotification } from './use-workout-notification'
import { WarmupCard, type WarmupCardData } from './warmup-card'
import { SwapSheet, type SwapMode, type SwapOption } from './swap-sheet'
import {
  loadAlternativeCardAction,
  replaceForeverAction,
} from '@/app/(app)/app/(client)/workout/actions'
import type { Feeling } from './feeling-picker'

type Props = {
  programId: string
  programDayId: string | null
  dayName: string
  mode: 'free' | 'guided'
  exercises: WorkoutExercise[]
  /** Запасные упражнения по карточкам дня (задаёт тренер). */
  alternatives?: Record<string, SwapOption[]>
  /** Разминка под тип дня; `null` — шаблонов нет. */
  warmup?: WarmupCardData | null
  rules: ProgressionRules
}

/** Оболочка тренировки: старт сессии, запись подходов, завершение. */
const swapsKey = (sessionUuid: string) => `workout-swaps:${sessionUuid}`

function readSwaps(sessionUuid: string): Record<string, WorkoutExercise> {
  try {
    return JSON.parse(localStorage.getItem(swapsKey(sessionUuid)) ?? '{}') as Record<string, WorkoutExercise>
  } catch {
    return {}
  }
}

export function WorkoutClient({
  programId,
  programDayId,
  dayName,
  mode,
  exercises: plannedExercises,
  alternatives = {},
  warmup = null,
  rules,
}: Props) {
  // «Только сегодня»: замены живут в памяти устройства до конца тренировки.
  const [swaps, setSwaps] = useState<Record<string, WorkoutExercise>>({})
  const [swapping, setSwapping] = useState<WorkoutExercise | null>(null)
  const exercises = plannedExercises.map((item) => swaps[item.programExerciseId] ?? item)
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
  const online = useOnline()

  // Уведомление на экране блокировки: текущее упражнение, вес и номер подхода.
  useWorkoutNotification({
    sessionClientUuid: session.session?.clientUuid ?? null,
    plan: exercises.map((item) => ({
      exerciseId: item.exerciseId,
      name: item.name,
      loadType: item.loadType,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      weightKg: item.startWeightKg,
    })),
    doneKey: exercises.map((item) => logged[item.programExerciseId]?.length ?? 0).join(','),
  })

  // Подход, добавленный кнопкой в уведомлении, приходит через IndexedDB: перечитываем его.
  useEffect(() => {
    const uuid = session.session?.clientUuid
    if (!uuid || !('serviceWorker' in navigator)) return

    async function reload(): Promise<void> {
      const rows = await (await getOfflineDb()).sets.where('sessionClientUuid').equals(uuid!).toArray()
      const byExercise = new Map(exercises.map((item) => [item.exerciseId, item.programExerciseId]))
      const next: Record<string, LoggedSet[]> = {}

      for (const row of rows.sort((a, b) => a.setIndex - b.setIndex)) {
        const key = byExercise.get(row.exerciseId)
        if (!key) continue
        next[key] = [...(next[key] ?? []), { index: row.setIndex, weightKg: row.weightKg, reps: row.reps }]
      }

      loggedRef.current = next
      setLogged(next)
    }

    function onMessage(event: MessageEvent): void {
      if ((event.data as { type?: string } | null)?.type === 'workout-set-added') void reload()
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  })

  // Вес «на следующий раз», не ушедший из-за сети, досылаем, когда она появилась.
  useEffect(() => {
    if (online) void flushPendingNextWeights()
  }, [online])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function boot(): Promise<void> {
      try {
        // Продолжаем незавершённую тренировку (в том числе после закрытия приложения офлайн)
        // или начинаем новую; решение — по данным IndexedDB.
        const active = await session.startOrResume({ programDayId, mode, programSnapshot: plannedExercises })
        const savedSwaps = readSwaps(active.clientUuid)
        setSwaps(savedSwaps)
        const cards = plannedExercises.map((item) => savedSwaps[item.programExerciseId] ?? item)

        const rows = await (await getOfflineDb()).sets
          .where('sessionClientUuid')
          .equals(active.clientUuid)
          .toArray()

        // подходы хранятся по `exerciseId`, экран ведёт учёт по карточкам (`programExerciseId`)
        const cardByExercise = new Map(cards.map((item) => [item.exerciseId, item.programExerciseId]))
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
      plannedExercises.flatMap((item) => [item.videoMp4Url, item.posterUrl].filter((url): url is string => !!url)),
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
    // Подход показываем сразу: запись в IndexedDB идёт следом и почти всегда успевает.
    // Раньше строка появлялась только после ответа хранилища — казалось, что нажатие «не сработало».
    setLogged(loggedRef.current)

    void session
      .logSet({ exerciseId: exercise.exerciseId, setIndex: next.length, weightKg, reps })
      .then(() => {
        setStorageFailed(false)
        setLogged(loggedRef.current)
      })
      .catch((error: unknown) => {
        console.error('[offline] подход не сохранён', error)
        // Не сохранился — убираем строку из списка, чтобы не было «фантомного» подхода.
        loggedRef.current = { ...loggedRef.current, [key]: list }
        setLogged(loggedRef.current)
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
    if (exercise.loadType === 'bodyweight') {
      const own = recommendBodyweight({
        target: { sets: exercise.sets, repMin: exercise.repMin, repMax: exercise.repMax },
        history: [
          { date: new Date(), sets: today },
          ...exercise.history.map((item) => ({ date: new Date(item.date), sets: item.sets })),
        ],
        tip: exercise.tips,
      })
      setNextRecommendations((current) => ({
        ...current,
        [exercise.programExerciseId]: { weightKg: null, action: 'none', text: own.text },
      }))
      return
    }

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

  async function nextWeight(exercise: WorkoutExercise, weightKg: number): Promise<void> {
    // Для «своего веса» килограммы не храним.
    if (exercise.loadType === 'bodyweight') return
    await postNextWeight({ exerciseId: exercise.exerciseId, weightKg })
  }


  /** Варианты замены: список тренера плюс исходное упражнение, если уже меняли. */
  function swapOptions(card: WorkoutExercise): SwapOption[] {
    const original = plannedExercises.find((item) => item.programExerciseId === card.programExerciseId)
    const list = [...(alternatives[card.programExerciseId] ?? [])]
    if (original && original.exerciseId !== card.exerciseId) {
      list.unshift({ id: original.exerciseId, name: original.name, machineName: original.machineName })
    }
    return list.filter((option) => option.id !== card.exerciseId)
  }

  /** Кнопка видна, если у упражнения есть запасные: посмотреть их можно всегда. */
  function canSwap(card: WorkoutExercise): boolean {
    return swapOptions(card).length > 0
  }

  /** Почему заменить сейчас нельзя; `null` — можно. */
  function swapLockedReason(card: WorkoutExercise): string | null {
    if ((logged[card.programExerciseId]?.length ?? 0) > 0) {
      return 'Подход уже записан: заменить можно только до первого подхода'
    }
    if (!online) return 'Нет сети: заменить можно, когда она появится'
    return null
  }

  async function swap(card: WorkoutExercise, option: SwapOption, swapMode: SwapMode): Promise<string | null> {
    const result =
      swapMode === 'forever'
        ? await replaceForeverAction(card.programExerciseId, option.id)
        : await loadAlternativeCardAction(card.programExerciseId, option.id)
    if ('error' in result) return result.error

    const next = { ...swaps, [card.programExerciseId]: result.card }
    setSwaps(next)
    try {
      if (session.session) localStorage.setItem(swapsKey(session.session.clientUuid), JSON.stringify(next))
    } catch {
      // Память устройства недоступна — замена останется до перезагрузки.
    }
    return null
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
    void dismissWorkoutNotification()
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
          {!online ? (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-warning">
              Офлайн · запишем позже
            </span>
          ) : session.pending > 0 ? (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-text-secondary">
              Сохраняем…
            </span>
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
          Подход не сохранился на устройстве — нажми ещё раз. Если не помогает, обнови страницу.
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

      {warmup && session.session ? (
        <WarmupCard
          data={warmup}
          status={session.session.warmupStatus ?? null}
          onStatus={(status) => void session.setWarmup(status)}
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
          canSwap={canSwap}
          onSwap={setSwapping}
        />
      ) : (
        <FreeMode
          exercises={exercises}
          logged={logged}
          onLog={log}
          onFeeling={feel}
          onNextWeight={nextWeight}
          nextRecommendations={nextRecommendations}
          canSwap={canSwap}
          onSwap={setSwapping}
        />
      )}

      {swapping ? (
        <SwapSheet
          exerciseName={swapping.name}
          options={swapOptions(swapping)}
          lockedReason={swapLockedReason(swapping)}
          onClose={() => setSwapping(null)}
          onPick={(option, swapMode) => swap(swapping, option, swapMode)}
        />
      ) : null}

      <Button type="button" variant="secondary" onClick={() => void finish()}>
        Завершить тренировку
      </Button>
    </div>
  )
}