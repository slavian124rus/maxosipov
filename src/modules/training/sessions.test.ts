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
  getExerciseProgress,
  getHistoryForExercise,
  getOngoingSession,
  getRecommendations,
  getTrainedExercises,
  getWeeklyVolume,
  getWeekWorkoutDays,
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
test('нет такого упражнения и кривые числа → rejected, остальные принимаются', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-rej',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  const result = await syncSets(clientId, [
    { ...setItem('s-rej', 1), exerciseId: '00000000-0000-4000-8000-0000000000aa' },
    setItem('s-rej', 2, -5),
    setItem('s-rej', 3, 50, 0),
    setItem('s-rej', 4),
  ])

  expect(result.accepted).toEqual(['s-rej-4'])
  expect(result.rejected.sort()).toEqual(['s-rej-1', 's-rej-2', 's-rej-3'])
})

test('сессия ещё не создана: подход не принят и не отклонён — клиент повторит', async () => {
  const result = await syncSets(clientId, [setItem('s-none', 1)])
  expect(result).toEqual({ accepted: [], rejected: [] })

  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-none',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })
  expect((await syncSets(clientId, [setItem('s-none', 1)])).accepted).toEqual(['s-none-1'])
})

test('чужой client_uuid не перезаписывает подход другого пользователя', async () => {
  const [me] = await db.select().from(users).where(eq(users.id, clientId))
  const [other] = await db
    .insert(users)
    .values({ phone: '+79990000012', name: 'Другой', gymId, roleId: me!.roleId })
    .returning()

  const now = new Date('2026-11-07T09:00:00Z')
  await startSession(clientId, { programDayId: null, mode: 'free', clientUuid: 'mine', startedAt: now })
  await startSession(other!.id, { programDayId: null, mode: 'free', clientUuid: 'theirs', startedAt: now })

  await syncSets(clientId, [setItem('mine', 1, 50, 12, 'shared-uuid')])
  const result = await syncSets(other!.id, [setItem('theirs', 1, 999, 1, 'shared-uuid')])

  expect(result).toEqual({ accepted: [], rejected: ['shared-uuid'] })
  const [row] = await db.select().from(setLogs).where(eq(setLogs.clientUuid, 'shared-uuid'))
  expect(row?.weightKg).toBe(50)
  expect(row?.reps).toBe(12)
})

test('повторная отправка подхода без ощущения не стирает выставленное', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-feel',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  await syncSets(clientId, [setItem('s-feel', 1)])
  await setExerciseFeeling(clientId, 's-feel', exerciseId, 'easy')
  await syncSets(clientId, [setItem('s-feel', 1)])

  const [row] = await db.select().from(setLogs).where(eq(setLogs.clientUuid, 's-feel-1'))
  expect(row?.feeling).toBe('easy')
})

test('повторное завершение тренировки не ставит задачу второй раз', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-fin',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  const queued: string[] = []
  const enqueue = async (name: string): Promise<void> => void queued.push(name)

  await finishSession(clientId, 's-fin', { finishedAt: new Date('2026-11-07T10:00:00Z') }, { enqueue })
  await finishSession(clientId, 's-fin', { finishedAt: new Date('2026-11-07T11:00:00Z') }, { enqueue })

  expect(queued).toEqual(['session.summary'])
  const [session] = await db.select().from(workoutSessions).where(eq(workoutSessions.clientUuid, 's-fin'))
  expect(session?.finishedAt?.toISOString()).toBe('2026-11-07T10:00:00.000Z')
})

test('вес 62,3 сохраняется и читается ровно (double precision)', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-precise',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  await syncSets(clientId, [setItem('s-precise', 1, 62.3, 10)])

  const [row] = await db.select().from(setLogs).where(eq(setLogs.clientUuid, 's-precise-1'))
  expect(row?.weightKg).toBe(62.3)
})

test('getHistoryForExercise отдаёт ровно N последних тренировок', async () => {
  for (let index = 0; index < 5; index += 1) {
    const uuid = `s-hist-${index}`
    await startSession(clientId, {
      programDayId: dayId,
      mode: 'free',
      clientUuid: uuid,
      startedAt: new Date(`2026-11-0${index + 1}T09:00:00Z`),
    })
    await syncSets(clientId, [setItem(uuid, 1, 40 + index, 10)])
  }

  const history = await getHistoryForExercise(clientId, exerciseId, 2)
  expect(history).toHaveLength(2)
  expect(history[0]?.date.toISOString()).toBe(new Date('2026-11-05T09:00:00Z').toISOString())
  expect(history[1]?.date.toISOString()).toBe(new Date('2026-11-04T09:00:00Z').toISOString())
})

test('getWeekWorkoutDays учитывает часовой пояс зала', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 's-week',
    startedAt: new Date('2026-11-01T20:00:00Z'),
  })
  await finishSession(
    clientId,
    's-week',
    { finishedAt: new Date('2026-11-01T21:00:00Z') },
    { enqueue: async () => {} },
  )

  // 2026-11-01T21:00Z — это 2 ноября 04:00 по Красноярску (понедельник → индекс 0)
  const krasnoyarsk = await getWeekWorkoutDays(
    clientId,
    new Date('2026-11-02T10:00:00Z'),
    'Asia/Krasnoyarsk',
  )
  expect(krasnoyarsk[0]).toBe(true)

  // В UTC тот же момент — воскресенье предыдущей недели
  const utc = await getWeekWorkoutDays(clientId, new Date('2026-11-02T10:00:00Z'), 'UTC')
  expect(utc[0]).toBe(false)
})

test('getExerciseProgress: максимум сессии, разминка и незавершённые не мешают', async () => {
  for (const [uuid, date] of [
    ['p-1', '2026-11-01T09:00:00Z'],
    ['p-2', '2026-11-05T09:00:00Z'],
  ] as const) {
    await startSession(clientId, {
      programDayId: dayId,
      mode: 'free',
      clientUuid: uuid,
      startedAt: new Date(date),
    })
    await syncSets(clientId, [
      setItem(uuid, 1, 20, 15, `${uuid}-warm`),
      setItem(uuid, 2, uuid === 'p-1' ? 50 : 55, 10, `${uuid}-work`),
    ])
    await finishSession(clientId, uuid, { finishedAt: new Date(date) }, { enqueue: async () => {} })
  }

  // незавершённая тренировка с большим весом не попадает в график
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 'p-3',
    startedAt: new Date('2026-11-06T09:00:00Z'),
  })
  await syncSets(clientId, [setItem('p-3', 1, 100, 5, 'p-3-work')])

  const progress = await getExerciseProgress(clientId, exerciseId)
  expect(progress.map((point) => point.workingWeightKg)).toEqual([50, 55])
  expect(progress[0]?.date.toISOString()).toBe(new Date('2026-11-01T09:00:00Z').toISOString())
})

test('getWeeklyVolume: 8 недель подряд, пустые недели — нули', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 'vol-1',
    startedAt: new Date(),
  })
  await syncSets(clientId, [setItem('vol-1', 1, 50, 10, 'vol-1-a')])
  await finishSession(clientId, 'vol-1', { finishedAt: new Date() }, { enqueue: async () => {} })

  const weeks = await getWeeklyVolume(clientId, 8, 'Asia/Krasnoyarsk')

  expect(weeks).toHaveLength(8)
  expect(weeks.at(-1)?.volumeKg).toBe(500)
  expect(weeks.slice(0, -1).every((week) => week.volumeKg === 0)).toBe(true)
  expect(weeks.map((week) => week.weekStart)).toEqual(
    [...weeks.map((week) => week.weekStart)].sort(),
  )
})

test('getTrainedExercises: только упражнения из завершённых тренировок', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 'te-1',
    startedAt: new Date('2026-11-01T09:00:00Z'),
  })
  await syncSets(clientId, [setItem('te-1', 1, 50, 10, 'te-1-a')])
  await finishSession(
    clientId,
    'te-1',
    { finishedAt: new Date('2026-11-01T10:00:00Z') },
    { enqueue: async () => {} },
  )

  const list = await getTrainedExercises(clientId)
  expect(list).toHaveLength(1)
  expect(list[0]?.exerciseId).toBe(exerciseId)
  expect(list[0]?.sessions).toBe(1)
})

test('getOngoingSession: незавершённая тренировка видна, завершённая — нет', async () => {
  const now = new Date('2026-11-07T12:00:00Z')

  // Ничего не начато.
  expect(await getOngoingSession(clientId, now)).toBeNull()

  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 'ongoing-1',
    startedAt: new Date('2026-11-07T11:30:00Z'),
  })

  const ongoing = await getOngoingSession(clientId, now)
  expect(ongoing).toMatchObject({ dayId })

  // Завершили — экран «Сегодня» больше не предлагает «Продолжить».
  await finishSession(
    clientId,
    'ongoing-1',
    { finishedAt: new Date('2026-11-07T11:55:00Z') },
    { enqueue: async () => {} },
  )
  expect(await getOngoingSession(clientId, now)).toBeNull()
})

test('getOngoingSession: брошенная тренировка старше 12 часов не считается', async () => {
  await startSession(clientId, {
    programDayId: dayId,
    mode: 'free',
    clientUuid: 'ongoing-old',
    startedAt: new Date('2026-11-07T09:00:00Z'),
  })

  expect(await getOngoingSession(clientId, new Date('2026-11-07T09:30:00Z'))).not.toBeNull()
  expect(await getOngoingSession(clientId, new Date('2026-11-07T22:00:00Z'))).toBeNull()
})
