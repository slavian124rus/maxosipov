import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import type { Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { applyProgramPatchAs, getClientEditStatus, getProgramTree, markClientEditSeen } from './programs'
import { nextWeights, programDays, programExercises, programs, setLogs, workoutSessions } from './schema'
import { lastWorkingWeights, resolvePlanWeights } from './weights'

let gymId: string
let clientId: string
let actor: Actor
let programId: string
let dayId: string
let squat: string
let press: string
let bridge: string

async function addExercise(name: string, loadType: 'external' | 'bodyweight' = 'external') {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      name,
      loadType,
      slug: `${name}-${Math.random().toString(36).slice(2, 8)}`,
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
    })
    .returning({ id: exercises.id })
  return row!.id
}

async function addItem(exerciseId: string, order: number, weight: number | null = null) {
  const [row] = await db
    .insert(programExercises)
    .values({ dayId, order, exerciseId, targetWeightKg: weight })
    .returning({ id: programExercises.id })
  return row!.id
}

async function finishedSession(exerciseId: string, weights: number[], daysAgo: number) {
  const startedAt = new Date(Date.now() - daysAgo * 86_400_000)
  const [session] = await db
    .insert(workoutSessions)
    .values({ userId: clientId, clientUuid: randomUUID(), startedAt, finishedAt: startedAt })
    .returning({ id: workoutSessions.id })

  for (const [index, weightKg] of weights.entries()) {
    await db.insert(setLogs).values({
      sessionId: session!.id,
      exerciseId,
      setIndex: index + 1,
      weightKg,
      reps: 10,
      clientUuid: randomUUID(),
    })
  }
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
      address: 'Красноярск',
      brand: { name: 'М', shortName: 'М', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 },
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
  actor = {
    id: clientId,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'own' }],
  }

  const [program] = await db
    .insert(programs)
    .values({ gymId, ownerId: clientId, authorId: clientId, authorKind: 'client', name: 'Моя' })
    .returning()
  programId = program!.id
  const [day] = await db
    .insert(programDays)
    .values({ programId, order: 1, name: 'День 1' })
    .returning()
  dayId = day!.id

  squat = await addExercise('Присед')
  press = await addExercise('Жим')
  bridge = await addExercise('Мостик на коврике', 'bodyweight')
})

test('lastWorkingWeights: максимум самой свежей завершённой тренировки', async () => {
  await finishedSession(squat, [20, 30], 10)
  await finishedSession(squat, [40, 50], 3)

  expect(await lastWorkingWeights(clientId, [squat])).toEqual({ [squat]: 50 })
})

test('resolvePlanWeights: «на следующий раз» важнее истории, история важнее пустоты', async () => {
  const a = await addItem(squat, 1)
  const b = await addItem(press, 2)
  await finishedSession(squat, [40], 2)
  await finishedSession(press, [25], 2)
  await db.insert(nextWeights).values({ userId: clientId, exerciseId: squat, weightKg: 45 })

  const filled = await resolvePlanWeights(programId, clientId)
  expect(filled).toBe(2)

  const tree = await getProgramTree(programId)
  const items = tree!.days[0]!.exercises
  expect(items.find((item) => item.id === a)!.targetWeightKg).toBe(45)
  expect(items.find((item) => item.id === b)!.targetWeightKg).toBe(25)
})

test('resolvePlanWeights: заданный вес не трогаем, «свой вес» пропускаем', async () => {
  await addItem(squat, 1, 60)
  const bridgeItem = await addItem(bridge, 2)
  await finishedSession(squat, [40], 2)
  await finishedSession(bridge, [16], 2)

  await resolvePlanWeights(programId, clientId)

  const items = (await getProgramTree(programId))!.days[0]!.exercises
  expect(items[0]!.targetWeightKg).toBe(60)
  expect(items.find((item) => item.id === bridgeItem)!.targetWeightKg).toBeNull()
})

test('replace_exercise сбрасывает вес старого упражнения и подбирает новый по истории', async () => {
  const item = await addItem(squat, 1, 100)
  await finishedSession(press, [30], 2)

  const tree = await applyProgramPatchAs(
    actor,
    programId,
    { ops: [{ op: 'replace_exercise', programExerciseId: item, exerciseId: press }] },
    'client',
  )

  expect(tree.days[0]!.exercises[0]!.targetWeightKg).toBe(30)

  const [row] = await db.select().from(programs).where(eq(programs.id, programId))
  expect(row!.clientEditedAt).not.toBeNull()
})

test('replace_exercise без истории оставляет вес пустым, а не переносит старый', async () => {
  const item = await addItem(squat, 1, 100)

  const tree = await applyProgramPatchAs(
    actor,
    programId,
    { ops: [{ op: 'replace_exercise', programExerciseId: item, exerciseId: press }] },
    'client',
  )

  expect(tree.days[0]!.exercises[0]!.targetWeightKg).toBeNull()
})

test('правка клиента помечает план как непросмотренный, просмотр Максимом снимает метку', async () => {
  const item = await addItem(squat, 1)
  const boss: Actor = { id: randomUUID(), roleId: actor.roleId, gymId, isOwner: true, permissions: [] }

  expect(await getClientEditStatus(programId)).toEqual({ editedAt: null, unseen: false })

  await applyProgramPatchAs(actor, programId, { ops: [{ op: 'set_sets_reps', programExerciseId: item, sets: 4 }] }, 'client')
  const edited = await getClientEditStatus(programId)
  expect(edited.unseen).toBe(true)
  expect(edited.editedAt).toBeInstanceOf(Date)

  await markClientEditSeen(boss, programId)
  expect((await getClientEditStatus(programId)).unseen).toBe(false)

  await applyProgramPatchAs(actor, programId, { ops: [{ op: 'set_sets_reps', programExerciseId: item, sets: 5 }] }, 'client')
  expect((await getClientEditStatus(programId)).unseen).toBe(true)
})

test('правка тренера не помечает план как изменённый клиентом', async () => {
  const item = await addItem(squat, 1)
  const boss: Actor = { id: randomUUID(), roleId: actor.roleId, gymId, isOwner: true, permissions: [] }

  await applyProgramPatchAs(boss, programId, { ops: [{ op: 'set_sets_reps', programExerciseId: item, sets: 4 }] }, 'trainer')
  expect((await getClientEditStatus(programId)).unseen).toBe(false)
})
