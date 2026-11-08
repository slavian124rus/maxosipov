import { getOfflineDb, type OfflineSet } from './db'

const BATCH_SIZE = 50

/** Подход записывается локально мгновенно и ждёт отправки. */
export async function enqueueSet(set: Omit<OfflineSet, 'synced'>): Promise<void> {
  await (await getOfflineDb()).sets.put({ ...set, synced: 0 })
}

/**
 * Отправляет несинхронизированные подходы пачками по 50.
 * Принятые сервером помечаются `synced: 1`, остальные остаются в очереди.
 */
export async function flushQueue(
  fetchFn: typeof fetch = fetch,
): Promise<{ sent: number; failed: number }> {
  const pending = await (await getOfflineDb()).sets.where('synced').equals(0).limit(BATCH_SIZE).toArray()

  if (pending.length === 0) return { sent: 0, failed: 0 }

  try {
    const response = await fetchFn('/api/training/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: pending.map((set) => ({
          clientUuid: set.clientUuid,
          sessionClientUuid: set.sessionClientUuid,
          exerciseId: set.exerciseId,
          setIndex: set.setIndex,
          weightKg: set.weightKg,
          reps: set.reps,
          ...(set.feeling ? { feeling: set.feeling } : {}),
          ...(set.startedAt ? { startedAt: set.startedAt } : {}),
          ...(set.finishedAt ? { finishedAt: set.finishedAt } : {}),
          loggedOffline: set.loggedOffline,
        })),
      }),
    })

    if (!response.ok) return { sent: 0, failed: pending.length }

    const body = (await response.json()) as { accepted?: string[] }
    const accepted = new Set(body.accepted ?? [])

    if (accepted.size > 0) {
      await (await getOfflineDb()).sets.where('clientUuid').anyOf([...accepted]).modify({ synced: 1 })
    }

    return { sent: accepted.size, failed: pending.length - accepted.size }
  } catch {
    return { sent: 0, failed: pending.length }
  }
}

/** Сколько подходов ещё не ушло на сервер. */
export async function pendingCount(): Promise<number> {
  return (await getOfflineDb()).sets.where('synced').equals(0).count()
}