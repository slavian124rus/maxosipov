'use client'

import { useCallback, useRef, useState } from 'react'
import { getOfflineDb, type ActiveSessionRecord, type OfflineFeeling } from './db'
import { enqueueSet, findActiveSession, flushAll, pendingCount } from './queue'

/** Незавершённая тренировка старше этого срока считается брошенной. */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000

export type StartInput = {
  programDayId: string | null
  mode: 'free' | 'guided'
  programSnapshot: unknown
}

export type LogInput = {
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  feeling?: OfflineFeeling
}

/**
 * Активная тренировка: всё пишется в IndexedDB мгновенно, отправка — в фоне
 * (`flushAll`: старт → подходы → завершение; периодически его запускает `OfflineSync`).
 */
export function useActiveSession() {
  const [session, setSession] = useState<ActiveSessionRecord | null>(null)
  const [pending, setPending] = useState(0)
  const sessionRef = useRef<ActiveSessionRecord | null>(null)
  /** Старт ещё выполняется: подход, записанный в этот момент, должен его дождаться. */
  const startingRef = useRef<Promise<ActiveSessionRecord> | null>(null)

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  const flush = useCallback(async () => {
    try {
      await flushAll()
    } finally {
      await refreshPending()
    }
  }, [refreshPending])

  /**
   * Продолжает незавершённую тренировку того же дня или начинает новую.
   * Решение принимается по данным из IndexedDB, а не по React-состоянию (оно ещё пустое).
   */
  const startOrResume = useCallback(
    async (input: StartInput): Promise<ActiveSessionRecord> => {
      const promise = (async (): Promise<ActiveSessionRecord> => {
        const db = await getOfflineDb()
        const existing = await findActiveSession()

        if (existing) {
          const fresh = Date.now() - new Date(existing.startedAt).getTime() < STALE_SESSION_MS

          if (fresh && existing.programDayId === input.programDayId) {
            sessionRef.current = existing
            setSession(existing)
            void refreshPending()
            return existing
          }

          // брошенная или от другого дня: закрываем (уйдёт на сервер как завершённая)
          await db.activeSession.update(existing.clientUuid, {
            finishRequestedAt: new Date().toISOString(),
          })
        }

        const record: ActiveSessionRecord = {
          clientUuid: crypto.randomUUID(),
          programDayId: input.programDayId,
          mode: input.mode,
          startedAt: new Date().toISOString(),
          programSnapshot: input.programSnapshot,
          startSynced: false,
        }

        await db.activeSession.put(record)
        sessionRef.current = record
        setSession(record)
        void flush()

        return record
      })()

      startingRef.current = promise
      try {
        return await promise
      } finally {
        startingRef.current = null
      }
    },
    [flush, refreshPending],
  )

  const logSet = useCallback(
    async (input: LogInput): Promise<void> => {
      // Первый подход могли нажать раньше, чем закончился старт тренировки:
      // ждём его, иначе подход молча терялся и клиент нажимал кнопку повторно.
      const active =
        sessionRef.current ??
        (startingRef.current ? await startingRef.current.catch(() => null) : null)

      if (!active) throw new Error('Тренировка не начата')

      await enqueueSet({
        clientUuid: crypto.randomUUID(),
        sessionClientUuid: active.clientUuid,
        exerciseId: input.exerciseId,
        setIndex: input.setIndex,
        weightKg: input.weightKg,
        reps: input.reps,
        ...(input.feeling ? { feeling: input.feeling } : {}),
        finishedAt: new Date().toISOString(),
        loggedOffline: !navigator.onLine,
      })

      await refreshPending()
      void flush()
    },
    [flush, refreshPending],
  )

  /** Ощущение пишется во все подходы упражнения и помечает их неотправленными — уйдут вместе. */
  const setFeeling = useCallback(
    async (exerciseId: string, feeling: OfflineFeeling): Promise<void> => {
      const active = sessionRef.current
      if (!active) return

      await (await getOfflineDb()).sets
        .where('sessionClientUuid')
        .equals(active.clientUuid)
        .and((row) => row.exerciseId === exerciseId)
        .modify({ feeling, synced: 0 })

      await refreshPending()
      void flush()
    },
    [flush, refreshPending],
  )

  /** Разминка: статус хранится на устройстве и уходит вместе с завершением. */
  const setWarmup = useCallback(async (warmupStatus: 'done' | 'skipped'): Promise<void> => {
    const active = sessionRef.current
    if (!active) return
    await (await getOfflineDb()).activeSession.update(active.clientUuid, { warmupStatus })
    sessionRef.current = { ...active, warmupStatus }
    setSession(sessionRef.current)
  }, [])

  /** Завершение фиксируется локально; на сервер уйдёт, когда доставлены все подходы. */
  const finish = useCallback(async (): Promise<void> => {
    const active = sessionRef.current
    if (!active) return

    await (await getOfflineDb()).activeSession.update(active.clientUuid, {
      finishRequestedAt: new Date().toISOString(),
    })
    sessionRef.current = null
    setSession(null)

    await flush()
  }, [flush])

  /** Предзагрузка видео и постеров: Service Worker кладёт их в кэш `media`. */
  const precacheMedia = useCallback(async (urls: string[]): Promise<void> => {
    const unique = [...new Set(urls)].filter((url) => url.startsWith('/media/'))

    for (const url of unique) {
      try {
        await fetch(url)
      } catch {
        // без сети просто пропускаем
      }
    }
  }, [])

  return { session, pending, startOrResume, logSet, setFeeling, setWarmup, finish, flush, precacheMedia }
}
