import { getOfflineDb } from './db'
import { enqueueSet, flushQueue } from './queue'
import {
  nextNotification,
  type DoneSet,
  type NotifyExercise,
} from '@/shared/workout-notification'

/** Одно и то же уведомление перерисовывается, а не плодится. */
export const WORKOUT_NOTIFICATION_TAG = 'workout'
export const WORKOUT_ADD_SET_ACTION = 'add-set'
/** Переключатель в «Настройках»: по умолчанию включено. */
export const WORKOUT_NOTIFY_PREF_KEY = 'workout-lockscreen'

export function workoutNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(WORKOUT_NOTIFY_PREF_KEY) !== '0'
  } catch {
    return true
  }
}

async function readDone(sessionClientUuid: string): Promise<Record<string, DoneSet[]>> {
  const rows = await (await getOfflineDb()).sets
    .where('sessionClientUuid')
    .equals(sessionClientUuid)
    .toArray()
  const done: Record<string, DoneSet[]> = {}

  for (const row of rows.sort((a, b) => a.setIndex - b.setIndex)) {
    const list = done[row.exerciseId] ?? []
    list.push({ weightKg: row.weightKg, reps: row.reps })
    done[row.exerciseId] = list
  }
  return done
}

export async function saveNotifyPlan(
  sessionClientUuid: string,
  exercises: NotifyExercise[],
): Promise<void> {
  await (await getOfflineDb()).notifyPlan.put({ sessionClientUuid, exercises })
}

/** Показывает (или обновляет) уведомление «что сейчас делать». */
export async function renderWorkoutNotification(
  registration: ServiceWorkerRegistration,
  sessionClientUuid: string,
): Promise<void> {
  const plan = await (await getOfflineDb()).notifyPlan.get(sessionClientUuid)
  if (!plan) return

  const view = nextNotification(plan.exercises, await readDone(sessionClientUuid))
  const icon = '/icons/icon-192.png'
  const data = { kind: 'workout', url: '/workout', sessionClientUuid }

  // `actions` есть только у Android; iPhone и десктоп показывают один текст.
  const options: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
    tag: WORKOUT_NOTIFICATION_TAG,
    icon,
    badge: icon,
    silent: true,
    requireInteraction: true,
    data,
    ...(view
      ? {
          body: view.body,
          actions: [{ action: WORKOUT_ADD_SET_ACTION, title: view.actionTitle }],
        }
      : { body: 'Все подходы сделаны. Нажми, чтобы завершить тренировку' }),
  }

  await registration.showNotification(view?.title ?? 'Тренировка закончена', options)
}

export async function closeWorkoutNotification(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const list = await registration.getNotifications({ tag: WORKOUT_NOTIFICATION_TAG })
  for (const notification of list) notification.close()
}

/**
 * Кнопка «+ Подход» в уведомлении (Android): пишет подход в ту же очередь, что и экран,
 * отправляет её и перерисовывает уведомление на следующий подход.
 */
export async function addSetFromNotification(
  registration: ServiceWorkerRegistration,
  sessionClientUuid: string,
): Promise<boolean> {
  const db = await getOfflineDb()
  const plan = await db.notifyPlan.get(sessionClientUuid)
  const session = await db.activeSession.get(sessionClientUuid)
  if (!plan || !session || session.finishRequestedAt) return false

  const view = nextNotification(plan.exercises, await readDone(sessionClientUuid))
  if (!view) return false

  await enqueueSet({
    clientUuid: crypto.randomUUID(),
    sessionClientUuid,
    exerciseId: view.exerciseId,
    setIndex: view.setNumber,
    weightKg: view.weightKg,
    reps: view.reps,
    finishedAt: new Date().toISOString(),
    loggedOffline: !navigator.onLine,
  })

  await renderWorkoutNotification(registration, sessionClientUuid)
  void flushQueue()
  return true
}
