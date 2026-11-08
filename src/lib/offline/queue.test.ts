import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { getOfflineDb, type OfflineSet } from './db'
import { enqueueSet, flushQueue, pendingCount } from './queue'

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
  await (await getOfflineDb()).feelings.clear()
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