'use client'

import { useEffect } from 'react'
import {
  closeWorkoutNotification,
  renderWorkoutNotification,
  saveNotifyPlan,
  workoutNotifyEnabled,
} from '@/lib/offline/workout-notify'
import type { NotifyExercise } from '@/shared/workout-notification'

type Input = {
  sessionClientUuid: string | null
  plan: NotifyExercise[]
  /** Сколько подходов сделано по каждому упражнению: меняется — уведомление обновляется. */
  doneKey: string
}

function allowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    workoutNotifyEnabled()
  )
}

/** Держит уведомление тренировки на экране блокировки в актуальном состоянии. */
export function useWorkoutNotification({ sessionClientUuid, plan, doneKey }: Input): void {
  const planKey = JSON.stringify(plan)

  useEffect(() => {
    if (!sessionClientUuid || !allowed()) return

    // Подход пишется в IndexedDB чуть позже, чем появляется на экране: ждём, чтобы уведомление не отставало.
    const timer = setTimeout(() => {
      void (async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration) return
        await saveNotifyPlan(sessionClientUuid, JSON.parse(planKey) as NotifyExercise[])
        await renderWorkoutNotification(registration, sessionClientUuid)
      })().catch((error: unknown) => console.error('[notify] не удалось обновить уведомление', error))
    }, 400)

    return () => clearTimeout(timer)
  }, [sessionClientUuid, planKey, doneKey])
}

/** Убирает уведомление при завершении тренировки. */
export async function dismissWorkoutNotification(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) await closeWorkoutNotification(registration)
  } catch {
    // уведомление не критично
  }
}
