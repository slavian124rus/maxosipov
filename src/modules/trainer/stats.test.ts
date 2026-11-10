import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { getStats } from './stats'
import { addPainFlag, setupTrainerWorld, type TrainerWorld } from './test-setup'
import { subscriptionEvents } from '@/modules/access'
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
test('конверсия пробного: доля тех, у кого после пробы была выдача, среди закончивших пробу за 90 дней', async () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY)

  // Иван: проба закончилась 10 дней назад, потом купил. Мария: проба закончилась, не купила.
  await db.insert(subscriptionEvents).values([
    { userId: world.clientId, type: 'trial_started', createdAt: at(40) },
    { userId: world.clientId, type: 'granted', months: 1, createdAt: at(12) },
    { userId: world.otherClientId, type: 'trial_started', createdAt: at(45) },
  ])

  const stats = await getStats(world.trainer, now)
  expect(stats.trialToPaidRate).toBe(0.5)
})

test('конверсия: проба ещё идёт или закончилась больше 90 дней назад — не считается', async () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY)

  await db.insert(subscriptionEvents).values([
    { userId: world.clientId, type: 'trial_started', createdAt: at(10) },
    { userId: world.otherClientId, type: 'trial_started', createdAt: at(200) },
    { userId: world.otherClientId, type: 'granted', months: 1, createdAt: at(150) },
  ])

  expect((await getStats(world.trainer, now)).trialToPaidRate).toBeNull()
})

test('статистика тренера с областью own считается только по его клиентам', async () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY)

  await db.insert(subscriptionEvents).values([
    { userId: world.clientId, type: 'trial_started', createdAt: at(40) },
    { userId: world.clientId, type: 'granted', months: 1, createdAt: at(12) },
    { userId: world.otherClientId, type: 'trial_started', createdAt: at(45) },
  ])

  const ownScope = { ...world.otherTrainer, permissions: [
    { code: 'clients.view' as const, scope: 'own' as const },
    { code: 'analytics.view' as const, scope: 'own' as const },
  ] }

  const stats = await getStats(ownScope, now)
  expect(stats.activeClients).toBe(1)
  expect(stats.trialToPaidRate).toBe(0)
})

test('аналитика без права на клиентов: нули вместо ошибки', async () => {
  const analyst = { ...world.otherTrainer, permissions: [{ code: 'analytics.view' as const, scope: 'all' as const }] }

  const stats = await getStats(analyst)
  expect(stats.activeClients).toBe(0)
  expect(stats.trialToPaidRate).toBeNull()
})
