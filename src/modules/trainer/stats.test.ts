import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { getStats } from './stats'
import { addPainFlag, setupTrainerWorld, type TrainerWorld } from './test-setup'
import { workoutSessions } from '@/modules/training'
import { db } from '@/shared/db'

let world: TrainerWorld

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  world = await setupTrainerWorld()
})

test('пустая история: доля конверсии null, остальные метрики по клиентам', async () => {
  const stats = await getStats(world.trainer)

  expect(stats.activeClients).toBe(2)
  expect(stats.trials).toBe(2)
  expect(stats.trialToPaidRate).toBeNull()
  expect(stats.workoutsLast7d).toBe(0)
  expect(stats.aiMessagesLast7d).toBe(0)
})

test('завершённая тренировка и вопрос МаксИИму попадают в метрики за 7 дней', async () => {
  await db.insert(workoutSessions).values({
    userId: world.clientId,
    programDayId: null,
    mode: 'free',
    clientUuid: `s-${Date.now()}`,
    startedAt: new Date(),
    finishedAt: new Date(),
  })

  await addPainFlag(world.clientId, 'болит колено')

  const stats = await getStats(world.trainer)

  expect(stats.workoutsLast7d).toBe(1)
  expect(stats.aiMessagesLast7d).toBe(2)
})