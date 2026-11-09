import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { exercises, machines } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { recommend } from '@/modules/progression'
import {
  aiProposals,
  getHistoryForExercise,
  getProgramTree,
  programDays,
  programExercises,
  programs,
  setLogs,
  workoutSessions,
} from '@/modules/training'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { createCoachTools } from './tools'

let gymId: string
let clientId: string
let programId: string
let programExerciseId: string
let exerciseId: string
let exerciseBId: string

type Executable = { execute?: (input: unknown, options: unknown) => Promise<unknown> }

async function run(tool: unknown, input: unknown): Promise<unknown> {
  const executable = tool as Executable
  return executable.execute!(input, { toolCallId: 'test', messages: [], context: {} })
}

async function addExercise(name: string, status: 'published' | 'draft'): Promise<string> {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      name,
      slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status,
      defaultRepMin: 10,
      defaultRepMax: 12,
    })
    .returning({ id: exercises.id })
  return row!.id
}

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
      timezone: 'Asia/Krasnoyarsk',
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

  const [trainer] = await db
    .insert(users)
    .values({ phone: '+79990000002', name: 'Максим', gymId, roleId: roles['Главный тренер']!.id })
    .returning()

  const [client] = await db
    .insert(users)
    .values({ phone: '+79990000011', name: 'Клиент', gymId, roleId: roles['Клиент']!.id })
    .returning()
  clientId = client!.id

  const [machine] = await db
    .insert(machines)
    .values({ gymId, name: 'Тяга верхнего блока', weightStepKg: 5 })
    .returning()

  exerciseId = await addExercise('Тяга верхнего блока', 'published')
  exerciseBId = await addExercise('Тяга горизонтального блока', 'published')
  await db.update(exercises).set({ machineId: machine!.id }).where(eq(exercises.id, exerciseId))

  const [program] = await db
    .insert(programs)
    .values({
      gymId,
      ownerId: clientId,
      authorId: trainer!.id,
      authorKind: 'trainer',
      name: 'Старт: 3 дня',
      status: 'active',
    })
    .returning()
  programId = program!.id

  const [day] = await db
    .insert(programDays)
    .values({ programId, order: 1, name: 'День A' })
    .returning()

  const [item] = await db
    .insert(programExercises)
    .values({ dayId: day!.id, order: 1, exerciseId, sets: 3, repMin: 10, repMax: 12, restSec: 90 })
    .returning()
  programExerciseId = item!.id
})
test('propose_program_change с упражнением не из каталога — ошибка, предложение не создано', async () => {
  const program = await getProgramTree(programId)
  const tools = createCoachTools({ userId: clientId, conversationId: null, program })

  const result = await run(tools.propose_program_change, {
    patch: {
      ops: [
        {
          op: 'add_exercise',
          dayId: program!.days[0]!.id,
          exerciseId: randomUUID(),
          sets: 3,
          repMin: 10,
          repMax: 12,
        },
      ],
    },
  })

  expect(result).toEqual({ ok: false, error: 'Такого упражнения нет в каталоге зала' })
  expect(await db.select().from(aiProposals)).toHaveLength(0)
})

test('валидный патч создаёт pending-предложение, программа не меняется', async () => {
  const program = await getProgramTree(programId)
  const tools = createCoachTools({ userId: clientId, conversationId: null, program })

  const result = await run(tools.propose_program_change, {
    patch: {
      ops: [{ op: 'replace_exercise', programExerciseId, exerciseId: exerciseBId }],
    },
    rationale: 'Тяга горизонтального блока лучше для спины',
  })

  expect(result).toMatchObject({ ok: true })

  const proposals = await db.select().from(aiProposals)
  expect(proposals).toHaveLength(1)
  expect(proposals[0]?.kind).toBe('patch')
  expect(proposals[0]?.status).toBe('pending')
  expect(proposals[0]?.rationale).toBe('Тяга горизонтального блока лучше для спины')

  const after = await getProgramTree(programId)
  expect(after?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseId)
})

test('draft_workout с упражнением не из каталога — ошибка', async () => {
  const program = await getProgramTree(programId)
  const tools = createCoachTools({ userId: clientId, conversationId: null, program })

  const result = await run(tools.draft_workout, {
    name: 'Спина',
    days: [
      { name: 'День 1', exercises: [{ exerciseId: randomUUID(), sets: 3, repMin: 10, repMax: 12 }] },
    ],
  })

  expect(result).toEqual({ ok: false, error: 'Такого упражнения нет в каталоге зала' })
  expect(await db.select().from(aiProposals)).toHaveLength(0)
})

test('draft_workout создаёт предложение new_program', async () => {
  const program = await getProgramTree(programId)
  const tools = createCoachTools({ userId: clientId, conversationId: null, program })

  const result = await run(tools.draft_workout, {
    name: 'Спина и руки',
    days: [{ name: 'День 1', exercises: [{ exerciseId, sets: 4, repMin: 8, repMax: 10 }] }],
    rationale: 'Две тренировки в неделю',
  })

  expect(result).toMatchObject({ ok: true })

  const [proposal] = await db.select().from(aiProposals)
  expect(proposal?.kind).toBe('new_program')
  expect(proposal?.status).toBe('pending')
})

test('get_progression возвращает ровно recommend()', async () => {
  const [session] = await db
    .insert(workoutSessions)
    .values({
      userId: clientId,
      programDayId: null,
      mode: 'free',
      clientUuid: randomUUID(),
      startedAt: new Date(),
      finishedAt: new Date(),
    })
    .returning()

  for (let index = 1; index <= 3; index += 1) {
    await db.insert(setLogs).values({
      sessionId: session!.id,
      exerciseId,
      setIndex: index,
      weightKg: 50,
      reps: 12,
      feeling: 'easy',
      clientUuid: randomUUID(),
    })
  }

  const program = await getProgramTree(programId)
  const tools = createCoachTools({ userId: clientId, conversationId: null, program })
  const history = await getHistoryForExercise(clientId, exerciseId, 6, { finishedOnly: true })

  const expected = recommend(
    { target: { sets: 3, repMin: 10, repMax: 12 }, stepKg: 5, history },
    { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 },
  )

  const result = (await run(tools.get_progression, { exerciseId })) as { action: string }

  expect(result).toEqual(expected)
  expect(result.action).toBe('increase')
})