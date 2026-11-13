import { getOfflineDb, type ActiveSessionRecord, type OfflineSet } from './db'

const BATCH_SIZE = 50

/** Подход записывается локально мгновенно и ждёт отправки. */
export async function enqueueSet(set: Omit<OfflineSet, 'synced'>): Promise<void> {
  await (await getOfflineDb()).sets.put({ ...set, synced: 0 })
}

/**
 * Отправляет несинхронизированные подходы пачками по 50.
 * Принятые и отклонённые сервером (навсегда непригодные) помечаются `synced: 1` —
 * очередь не блокируется одним «битым» подходом; остальные остаются и уйдут позже.
 */
export async function flushQueue(
  fetchFn: typeof fetch = fetch,
): Promise<{ sent: number; failed: number }> {
  const db = await getOfflineDb()
  const pending = await db.sets.where('synced').equals(0).limit(BATCH_SIZE).toArray()

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

    const body = (await response.json()) as { accepted?: string[]; rejected?: string[] }
    const accepted = new Set(body.accepted ?? [])
    const rejected = new Set(body.rejected ?? [])
    const done = [...accepted, ...rejected]
    const sentFeeling = new Map(pending.map((set) => [set.clientUuid, set.feeling]))

    if (done.length > 0) {
      // Если пока шёл запрос, подход изменили (например, выбрали ощущение), он остаётся в очереди:
      // иначе отметка «отправлено» затёрла бы изменение и оно никогда не ушло бы на сервер.
      await db.sets
        .where('clientUuid')
        .anyOf(done)
        .modify((row) => {
          if (row.feeling === sentFeeling.get(row.clientUuid)) row.synced = 1
        })
    }

    return { sent: accepted.size, failed: pending.length - accepted.size - rejected.size }
  } catch {
    return { sent: 0, failed: pending.length }
  }
}

/** Сколько подходов ещё не ушло на сервер. */
export async function pendingCount(): Promise<number> {
  return (await getOfflineDb()).sets.where('synced').equals(0).count()
}

/** Текущая (не завершённая клиентом) тренировка на устройстве. */
export async function findActiveSession(): Promise<ActiveSessionRecord | null> {
  const all = await (await getOfflineDb()).activeSession.toArray()
  const open = all.filter((record) => !record.finishRequestedAt)
  open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return open[0] ?? null
}

let running: Promise<void> | null = null
/** Пока идёт отправка, могли добавить новый подход — тогда нужен ещё один проход. */
let rerunRequested = false

async function post(fetchFn: typeof fetch, url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return response.ok
  } catch {
    return false
  }
}

async function runFlushAll(fetchFn: typeof fetch): Promise<void> {
  const db = await getOfflineDb()

  // 1. Старт: без него сервер не примет подходы (сессия неизвестна). Идемпотентен.
  for (const record of await db.activeSession.toArray()) {
    if (record.startSynced) continue

    const ok = await post(fetchFn, '/api/training/start', {
      clientUuid: record.clientUuid,
      programDayId: record.programDayId,
      mode: record.mode,
      startedAt: record.startedAt,
    })
    if (ok) await db.activeSession.update(record.clientUuid, { startSynced: true })
  }

  // 2. Подходы — пока сервер принимает пачки.
  for (let round = 0; round < 20; round += 1) {
    const result = await flushQueue(fetchFn)
    if (result.sent === 0 || result.failed > 0) break
  }

  // 3. Завершение — только когда все подходы этой тренировки доставлены.
  for (const record of await db.activeSession.toArray()) {
    if (!record.finishRequestedAt || !record.startSynced) continue

    const left = await db.sets
      .where('sessionClientUuid')
      .equals(record.clientUuid)
      .and((row) => row.synced === 0)
      .count()
    if (left > 0) continue

    const ok = await post(fetchFn, '/api/training/finish', {
      sessionClientUuid: record.clientUuid,
      finishedAt: record.finishRequestedAt,
      ...(record.warmupStatus ? { warmupStatus: record.warmupStatus } : {}),
    })

    if (ok) {
      await db.sets.where('sessionClientUuid').equals(record.clientUuid).delete()
      await db.activeSession.delete(record.clientUuid)
    }
  }
}

/**
 * Досылает всё, что накопилось: старт → подходы → завершение.
 *
 * Безопасно вызывать из нескольких мест: параллельные вызовы сливаются в один проход.
 * Если во время прохода появился новый подход (клиент нажал «Записать подход», пока
 * шла отправка), запускается ещё один проход — иначе первый подход «терялся» и висел
 * в очереди до следующей фоновой синхронизации.
 */
export function flushAll(fetchFn: typeof fetch = fetch): Promise<void> {
  if (running) {
    rerunRequested = true
    return running
  }

  running = (async () => {
    do {
      rerunRequested = false
      await runFlushAll(fetchFn)
    } while (rerunRequested)
  })().finally(() => {
    running = null
    rerunRequested = false
  })

  return running
}
