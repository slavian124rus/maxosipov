import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { exercises, machines } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import {
  programDays,
  programExercises,
  programs,
  setLogs,
  workoutSessions,
} from './schema'
import {
  finishSession,
  getHistoryForExercise,
  getRecommendations,
  setExerciseFeeling,
  startSession,
  syncSets,
} from './sessions'

let gymId: string
let clientId: string
let exerciseId: string
let dayId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()

  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск, ул. Говорова',
      brand: { name: 'Максим Осипов', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: {
          sessionsToIncrease: 2,
          fastTrackOnEasy: true,
          failSessionsToDrop: 2,
          dropPercent: 10,
        },
        aiMemo: '',
      },
    })
    .returning()
  gymId = gym!.id

  const [client] = await db
    .insert(users)
    .values({ phone: '+79990000011', name: 'Клиент', gymId, roleId: roles['Клиент']!.id })
    .returning()
  clientId = client!.id

  const [machine] = await db
    .insert(machines)
    .values({ gymId, name: 'Блочный тренажёр', weightStepKg: 5 })
    .returning()

  const [exercise] = await db
    .insert(exercises)
    .values({
      gymId,
      machineId: machine!.id,
      name: 'Тяга верхнего блока',
      slug: 'tyaga',
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
      defaultRepMin: 10,
      defaultRepMax: 12,
    })
    .returning()
  exerciseId = exercise!.id

  const [program] = await db
    .insert(programs)
    .values({ gymId, ownerId: clientId, authorId: clientId, authorKind: 'client', name: 'Моя' })
    .returning()
  const [day] = await db
    .insert(programDays)
    .values({ programId: program!.id, name: 'День A', order: 1 })
    .returning()
  dayId = day!.id

  await db.insert(programExercises).values({
    dayId,
    order: 1,
    exerciseId,
    sets: 3,
    repMin: 10,
    repMax: 12,
    restSec: 90,
  })
})

function setItem(
  sessionUuid: string,
  index: number,
  weightKg = 50,
  reps = 12,
  clientUuid = `${sessionUuid}-${index}`,
) {
  return {
    clientUuid,
    sessionClientUuid: sessionUuid,
    exerciseId,
    setIndex: index,
    weightKg,
    reps,
    loggedOffline: false,
  }
}

test('повторная отправка тех же clientUuid создаёт одну запись', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  await syncSets(clientId, [setItem('s1', 1), setItem('s1', 2)])
  await syncSets(clientId, [setItem('s1', 1), setItem('s1', 2)])

  const rows = await db.select().from(setLogs)
  expect(rows).toHaveLength(2)
})

test('старт тренировки идемпотентен по clientUuid', async () => {
  const first = await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })
  const second = await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:05:00Z'),
  })

  expect(second.sessionId).toBe(first.sessionId)
  expect(await db.select().from(workoutSessions)).toHaveLength(1)
})

test('подходы с двух устройств в одну сессию сохраняются оба', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  await syncSets(clientId, [setItem('s1', 1, 50, 12, 'device-a-1')])
  await syncSets(clientId, [setItem('s1', 2, 50, 10, 'device-b-2')])

  const rows = await db.select().from(setLogs)
  expect(rows.map((row) => row.clientUuid).sort()).toEqual(['device-a-1', 'device-b-2'])
})

test('чужая сессия → ForbiddenError', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  await expect(syncSets('00000000-0000-4000-8000-00000000ffff', [setItem('s1', 1)])).rejects.toThrow(
    'Это чужая тренировка',
  )
})

test('setExerciseFeeling ставит ощущение всем подходам упражнения', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })
  await syncSets(clientId, [setItem('s1', 1), setItem('s1', 2), setItem('s1', 3)])

  await setExerciseFeeling(clientId, 's1', exerciseId, 'hard')

  const rows = await db.select().from(setLogs)
  expect(rows.every((row) => row.feeling === 'hard')).toBe(true)
})

test('getHistoryForExercise отдаёт новые сессии первыми', async () => {
  for (const [uuid, date] of [
    ['s1', '2026-11-01T09:00:00Z'],
    ['s2', '2026-11-05T09:00:00Z'],
  ] as const) {
    await startSession(clientId, {
      programDayId: dayId,
      mode: 'free',
      clientUuid: uuid,
      startedAt: new Date(date),
    })
    await syncSets(clientId, [setItem(uuid, 1, 40, 10)])
  }

  const history = await getHistoryForExercise(clientId, exerciseId)
  expect(history).toHaveLength(2)
  expect(history[0]?.date.toISOString()).toBe(new Date('2026-11-05T09:00:00Z').toISOString())
})

test('getRecommendations: две полные сессии → increase 55 с текстом', async () => {
  for (const [uuid, date] of [
    ['s1', '2026-11-01T09:00:00Z'],
    ['s2', '2026-11-05T09:00:00Z'],
  ] as const) {
    await startSession(clientId, {
      programDayId: dayId,
      mode: 'free',
      clientUuid: uuid,
      startedAt: new Date(date),
    })
    await syncSets(clientId, [setItem(uuid, 1), setItem(uuid, 2), setItem(uuid, 3)])
    await setExerciseFeeling(clientId, uuid, exerciseId, 'good')
  }

  const recommendations = await getRecommendations(clientId, dayId)
  expect(recommendations[exerciseId]?.action).toBe('increase')
  expect(recommendations[exerciseId]?.weightKg).toBe(55)
  expect(recommendations[exerciseId]?.text).toContain('Сегодня 55')
})

test('изменение программы после старта не трогает записанные подходы', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })
  await syncSets(clientId, [setItem('s1', 1, 50, 12)])

  await db
    .update(programExercises)
    .set({ sets: 5, repMin: 6, repMax: 8 })
    .where(and(eq(programExercises.dayId, dayId), eq(programExercises.exerciseId, exerciseId)))

  const rows = await db.select().from(setLogs)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ weightKg: 50, reps: 12 })
})

test('finishSession ставит задачу session.summary', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's1',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  const jobs: string[] = []
  await finishSession(
    clientId,
    's1',
    { finishedAt: new Date('2026-11-07T10:00:00Z') },
    { enqueue: async (name) => void jobs.push(name) },
  )

  expect(jobs).toEqual(['session.summary'])

  const [session] = await db.select().from(workoutSessions)
  expect(session?.finishedAt).toBeInstanceOf(Date)
})