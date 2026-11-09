'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { enqueueSet, flushAll } from '@/lib/offline/queue'
import { formatWeight } from '@/modules/progression'
import type { VoiceRow } from '@/modules/coach-ai'
import { VoiceLog } from './voice-log'

type Props = {
  durationMin: number
  exerciseCount: number
  volumeKg: number
  /** Тренировка на сервере; по нему опрашиваем итог МаксИИма. */
  sessionClientUuid?: string | null
  exercises: { id: string; name: string }[]
  onClose: () => void
}

const POLL_MS = 2000
const POLL_LIMIT_MS = 20_000

/** Сводка тренировки (DESIGN.md §8.5): время, упражнения, объём, итог МаксИИма. */
export function FinishSummary({
  durationMin,
  exerciseCount,
  volumeKg,
  sessionClientUuid,
  exercises,
  onClose,
}: Props) {
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionClientUuid) return

    let cancelled = false
    const startedAt = Date.now()

    async function poll(): Promise<void> {
      if (cancelled) return

      try {
        const response = await fetch(
          `/api/training/summary?sessionClientUuid=${encodeURIComponent(sessionClientUuid!)}`,
        )
        if (response.ok) {
          const body = (await response.json()) as { summary?: string | null }
          if (body.summary) {
            if (!cancelled) setSummary(body.summary)
            return
          }
        }
      } catch {
        // сеть пропала — попробуем на следующем шаге
      }

      if (cancelled || Date.now() - startedAt >= POLL_LIMIT_MS) return
      setTimeout(() => void poll(), POLL_MS)
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [sessionClientUuid])

  async function saveVoiceRows(rows: VoiceRow[]): Promise<void> {
    if (!sessionClientUuid) return

    const counts = new Map<string, number>()

    for (const row of rows) {
      if (!row.exerciseId) continue

      let index = counts.get(row.exerciseId) ?? 0

      for (const set of row.sets) {
        index += 1
        await enqueueSet({
          clientUuid: crypto.randomUUID(),
          sessionClientUuid,
          exerciseId: row.exerciseId,
          setIndex: index,
          weightKg: set.weightKg,
          reps: set.reps,
          ...(row.feeling ? { feeling: row.feeling } : {}),
          finishedAt: new Date().toISOString(),
          loggedOffline: !navigator.onLine,
        })
      }

      counts.set(row.exerciseId, index)
    }

    await flushAll()
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-1 px-4 py-5">
      <h2 className="text-[22px] font-semibold">Тренировка завершена</h2>

      <div className="flex flex-col gap-1 text-[15px] text-text-secondary">
        <p>Время: {durationMin} мин</p>
        <p>Упражнений: {exerciseCount}</p>
        <p>Объём: {formatWeight(volumeKg)}</p>
      </div>

      {summary ? (
        <div className="flex gap-3 rounded-card bg-surface-2 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[15px] text-white">
            М
          </div>
          <p className="text-[15px] text-text">{summary}</p>
        </div>
      ) : null}

      {sessionClientUuid ? (
        <VoiceLog
          sessionClientUuid={sessionClientUuid}
          exercises={exercises}
          onSave={saveVoiceRows}
        />
      ) : null}

      <Button type="button" onClick={onClose}>
        Готово
      </Button>
    </div>
  )
}