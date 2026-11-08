'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getOfflineDb, type ActiveSessionRecord, type OfflineFeeling } from './db'
import { enqueueSet, flushQueue, pendingCount } from './queue'

const FLUSH_INTERVAL_MS = 15_000

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
 * Активная тренировка: всё пишется в Dexie мгновенно, отправка — сразу,
 * затем каждые 15 секунд и по событию `online`.
 */
export function useActiveSession() {
  const [session, setSession] = useState<ActiveSessionRecord | null>(null)
  const [pending, setPending] = useState(0)
  const sessionRef = useRef<ActiveSessionRecord | null>(null)

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  const flush = useCallback(async () => {
    await flushQueue()
    await refreshPending()
  }, [refreshPending])

  useEffect(() => {
    void (async () => {
      try {
        const db = await getOfflineDb()
        const record = await db.activeSession.toCollection().first()
        const active = record ?? null
        sessionRef.current = active
        setSession(active)
        await refreshPending()
      } catch (error) {
        console.error('[offline] не удалось открыть локальную базу', error)
      }
    })()
  }, [refreshPending])

  useEffect(() => {
    const timer = setInterval(() => {
      void flush()
    }, FLUSH_INTERVAL_MS)

    const onOnline = (): void => {
      void flush()
    }

    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [flush])

  const start = useCallback(
    async (input: StartInput): Promise<ActiveSessionRecord> => {
      const record: ActiveSessionRecord = {
        clientUuid: crypto.randomUUID(),
        programDayId: input.programDayId,
        mode: input.mode,
        startedAt: new Date().toISOString(),
        programSnapshot: input.programSnapshot,
      }

      await (await getOfflineDb()).activeSession.put(record)
      sessionRef.current = record
      setSession(record)

      // Сервер узнает о старте, когда появится сеть; подходы всё равно сохранятся локально.
      try {
        await fetch('/api/training/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            clientUuid: record.clientUuid,
            programDayId: record.programDayId,
            mode: record.mode,
            startedAt: record.startedAt,
          }),
        })
      } catch {
        // офлайн — отправим позже вместе с подходами
      }

      return record
    },
    [],
  )

  const logSet = useCallback(
    async (input: LogInput): Promise<void> => {
      const active = sessionRef.current
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

  const setFeeling = useCallback(
    async (exerciseId: string, feeling: OfflineFeeling): Promise<void> => {
      const active = sessionRef.current
      if (!active) return

      await (await getOfflineDb()).feelings.add({
        sessionClientUuid: active.clientUuid,
        exerciseId,
        feeling,
        synced: 0,
      })
      await (await getOfflineDb()).sets
        .where('sessionClientUuid')
        .equals(active.clientUuid)
        .and((row) => row.exerciseId === exerciseId)
        .modify({ feeling })

      try {
        await fetch('/api/training/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [],
            feelings: [{ sessionClientUuid: active.clientUuid, exerciseId, feeling }],
          }),
        })
      } catch {
        // офлайн — ощущение уйдёт при следующей синхронизации
      }
    },
    [],
  )

  const finish = useCallback(async (): Promise<void> => {
    const active = sessionRef.current
    if (!active) return

    await flush()

    try {
      await fetch('/api/training/finish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionClientUuid: active.clientUuid,
          finishedAt: new Date().toISOString(),
        }),
      })
    } catch {
      // офлайн — завершим позже
    }

    await (await getOfflineDb()).activeSession.clear()
    sessionRef.current = null
    setSession(null)
  }, [flush])

  /** Предзагрузка видео упражнений: SW кладёт их в кэш `media`. */
  const precacheMedia = useCallback(async (urls: string[]): Promise<void> => {
    const unique = [...new Set(urls)].filter((url) => url.startsWith('/media/'))

    for (const url of unique) {
      try {
        await fetch(url, { cache: 'default' })
      } catch {
        // без сети просто пропускаем
      }
    }
  }, [])

  return { session, pending, start, logSet, setFeeling, finish, flush, precacheMedia }
}