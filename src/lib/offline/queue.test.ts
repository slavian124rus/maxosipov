import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { getOfflineDb, type OfflineSet } from './db'
import { enqueueSet, findActiveSession, flushAll, flushQueue, pendingCount } from './queue'

function set(index: number): Omit<OfflineSet, 'synced'> {
  return {
    clientUuid: `set-${index}`,
    sessionClientUuid: 'session-1',
    exerciseId: '00000000-0000-4000-8000-000000000001',
    setIndex: index,
    weightKg: 50,
    reps: 12,
    loggedOffline: true,
  }
}

beforeEach(async () => {
  await (await getOfflineDb()).sets.clear()
  await (await getOfflineDb()).activeSession.clear()
})

test('сеть падает: все три подхода остаются в очереди', async () => {
  for (const index of [1, 2, 3]) await enqueueSet(set(index))

  const result = await flushQueue(async () => {
    throw new Error('offline')
  })

  expect(result).toEqual({ sent: 0, failed: 3 })
  expect(await pendingCount()).toBe(3)
})

test('сеть вернулась: три подхода отправлены', async () => {
  for (const index of [1, 2, 3]) await enqueueSet(set(index))

  const result = await flushQueue(
    async () => new Response(JSON.stringify({ accepted: ['set-1', 'set-2', 'set-3'] }), { status: 200 }),
  )

  expect(result).toEqual({ sent: 3, failed: 0 })
  expect(await pendingCount()).toBe(0)
})

test('сервер принял только два: третий остаётся в очереди', async () => {
  for (const index of [1, 2, 3]) await enqueueSet(set(index))

  const result = await flushQueue(
    async () => new Response(JSON.stringify({ accepted: ['set-1', 'set-2'] }), { status: 200 }),
  )

  expect(result).toEqual({ sent: 2, failed: 1 })
  expect(await pendingCount()).toBe(1)

  const left = await (await getOfflineDb()).sets.where('synced').equals(0).toArray()
  expect(left.map((row) => row.clientUuid)).toEqual(['set-3'])
})

test('ответ 500 не помечает подходы отправленными', async () => {
  await enqueueSet(set(1))

  const result = await flushQueue(async () => new Response('nope', { status: 500 }))

  expect(result).toEqual({ sent: 0, failed: 1 })
  expect(await pendingCount()).toBe(1)
})

test('Dexie: выборка подходов сессии по индексу sessionClientUuid работает (регрессия SchemaError)', async () => {
  await enqueueSet(set(1))
  await enqueueSet({ ...set(2), sessionClientUuid: 'session-2' })

  const rows = await (await getOfflineDb()).sets.where('sessionClientUuid').equals('session-1').toArray()
  expect(rows.map((row) => row.clientUuid)).toEqual(['set-1'])

  await (await getOfflineDb()).sets
    .where('sessionClientUuid')
    .equals('session-1')
    .and((row) => row.exerciseId === set(1).exerciseId)
    .modify({ feeling: 'easy', synced: 0 })
  expect((await (await getOfflineDb()).sets.get('set-1'))?.feeling).toBe('easy')
})

test('отклонённый сервером подход не блокирует очередь', async () => {
  for (const index of [1, 2, 3]) await enqueueSet(set(index))

  const result = await flushQueue(
    async () =>
      new Response(JSON.stringify({ accepted: ['set-1', 'set-3'], rejected: ['set-2'] }), { status: 200 }),
  )

  expect(result).toEqual({ sent: 2, failed: 0 })
  expect(await pendingCount()).toBe(0)
})

type Call = { url: string; body: Record<string, unknown> }

function fakeServer(options: { online: () => boolean }) {
  const calls: Call[] = []
  const fetchFn = (async (url: string, init?: RequestInit) => {
    if (!options.online()) throw new Error('offline')
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    calls.push({ url, body })

    if (url === '/api/training/sync') {
      const items = (body.items as { clientUuid: string }[]) ?? []
      return new Response(JSON.stringify({ accepted: items.map((item) => item.clientUuid), rejected: [] }))
    }
    return new Response(JSON.stringify({ ok: true }))
  }) as typeof fetch

  return { calls, fetchFn }
}

async function startOfflineSession(): Promise<void> {
  await (await getOfflineDb()).activeSession.put({
    clientUuid: 'session-1',
    programDayId: null,
    mode: 'free',
    startedAt: new Date().toISOString(),
    programSnapshot: null,
    startSynced: false,
  })
}

test('старт без сети досылается раньше подходов, завершение — после них', async () => {
  let online = false
  const server = fakeServer({ online: () => online })

  await startOfflineSession()
  for (const index of [1, 2]) await enqueueSet(set(index))
  await (await getOfflineDb()).activeSession.update('session-1', {
    finishRequestedAt: new Date().toISOString(),
  })

  await flushAll(server.fetchFn)
  expect(server.calls).toEqual([])
  expect(await pendingCount()).toBe(2)
  expect(await findActiveSession()).toBeNull() // завершённая клиентом — не «активная»
  expect(await (await getOfflineDb()).activeSession.count()).toBe(1) // но с сервером не закрыта

  online = true
  await flushAll(server.fetchFn)

  expect(server.calls.map((call) => call.url)).toEqual([
    '/api/training/start',
    '/api/training/sync',
    '/api/training/finish',
  ])
  expect(await pendingCount()).toBe(0)
  expect(await (await getOfflineDb()).activeSession.count()).toBe(0)
  expect(await (await getOfflineDb()).sets.count()).toBe(0)
})

test('завершение не уходит, пока есть неотправленные подходы', async () => {
  const calls: string[] = []
  await startOfflineSession()
  await enqueueSet(set(1))
  await (await getOfflineDb()).activeSession.update('session-1', {
    finishRequestedAt: new Date().toISOString(),
  })

  const fetchFn = (async (url: string) => {
    calls.push(url)
    if (url === '/api/training/sync') return new Response('boom', { status: 500 })
    return new Response(JSON.stringify({ ok: true }))
  }) as typeof fetch

  await flushAll(fetchFn)

  expect(calls).toEqual(['/api/training/start', '/api/training/sync'])
  expect(await (await getOfflineDb()).activeSession.count()).toBe(1)
})

test('findActiveSession возвращает самую свежую незавершённую тренировку', async () => {
  const db = await getOfflineDb()
  const base = { programDayId: null, mode: 'free' as const, programSnapshot: null, startSynced: true }
  await db.activeSession.put({ ...base, clientUuid: 'old', startedAt: '2026-11-01T10:00:00.000Z' })
  await db.activeSession.put({ ...base, clientUuid: 'new', startedAt: '2026-11-08T10:00:00.000Z' })
  await db.activeSession.put({
    ...base,
    clientUuid: 'closed',
    startedAt: '2026-11-09T10:00:00.000Z',
    finishRequestedAt: '2026-11-09T11:00:00.000Z',
  })

  expect((await findActiveSession())?.clientUuid).toBe('new')
})


test('ощущение, выбранное во время отправки, не теряется', async () => {
  await enqueueSet(set(1))

  const result = await flushQueue(async () => {
    // пока запрос «летит», клиент выбрал «Легко»
    await (await getOfflineDb()).sets.update('set-1', { feeling: 'easy', synced: 0 })
    return new Response(JSON.stringify({ accepted: ['set-1'], rejected: [] }))
  })

  expect(result.sent).toBe(1)
  expect(await pendingCount()).toBe(1) // изменённый подход ещё надо отправить
})
