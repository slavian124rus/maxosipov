import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { applyProgramPatchAs, copyTemplateToClient, getActiveProgram, listProgramChanges } from './programs'
import { programChanges, programDays, programExercises, programs } from './schema'

let gymId: string
let client: Actor
let otherClient: Actor
let trainer: Actor
let trainerId: string
let templateId: string
let exerciseA: string
let exerciseB: string
let exerciseC: string

async function addExercise(name: string): Promise<string> {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      name,
      slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
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

  const [trainerRow] = await db
    .insert(users)
    .values({ phone: '+79990000002', name: 'Максим', gymId, roleId: roles['Главный тренер']!.id })
    .returning()
  trainerId = trainerRow!.id

  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId,
    })
    .returning()
  const [otherRow] = await db
    .insert(users)
    .values({ phone: '+79990000012', name: 'Другой', gymId, roleId: roles['Клиент']!.id })
    .returning()

  client = { id: clientRow!.id, roleId: roles['Клиент']!.id, gymId, isOwner: false, permissions: [] }
  otherClient = {
    id: otherRow!.id,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }
  trainer = {
    id: trainerId,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'own' }],
  }

  exerciseA = await addExercise('Тяга верхнего блока')
  exerciseB = await addExercise('Тяга горизонтального блока')
  exerciseC = await addExercise('Подъём на бицепс')

  const [template] = await db
    .insert(programs)
    .values({ gymId, ownerId: null, authorId: trainerId, authorKind: 'trainer', name: 'Старт: 3 дня' })
    .returning({ id: programs.id })
  templateId = template!.id

  const [day] = await db
    .insert(programDays)
    .values({ programId: templateId, name: 'День A — спина и бицепс', order: 1 })
    .returning({ id: programDays.id })

  await db.insert(programExercises).values({
    dayId: day!.id,
    order: 1,
    exerciseId: exerciseA,
    sets: 3,
    repMin: 10,
    repMax: 12,
  })
})

test('клиент применяет патч к своей программе, история пишется с actor_kind=client', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)
  const dayId = program.days[0]!.id

  const next = await applyProgramPatchAs(
    client,
    program.id,
    {
      ops: [
        { op: 'add_exercise', dayId, exerciseId: exerciseB, sets: 4, repMin: 8, repMax: 10 },
        { op: 'set_sets_reps', programExerciseId: program.days[0]!.exercises[0]!.id, sets: 5 },
      ],
    },
    'client',
  )

  expect(next.days[0]?.exercises).toHaveLength(2)
  expect(next.days[0]?.exercises[0]?.sets).toBe(5)

  const changes = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, program.id))
  expect(changes).toHaveLength(1)
  expect(changes[0]?.actorKind).toBe('client')
  expect(changes[0]?.actorId).toBe(client.id)
})

test('delete_day удаляет день с упражнениями из базы и пишет историю', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)
  const firstDayId = program.days[0]!.id

  // Добавили второй день, чтобы проверить переиндексацию оставшегося.
  const withSecond = await applyProgramPatchAs(
    client,
    program.id,
    { ops: [{ op: 'add_day', name: 'День B — ноги' }] },
    'client',
  )
  const secondDayId = withSecond.days[1]!.id

  const next = await applyProgramPatchAs(
    client,
    program.id,
    { ops: [{ op: 'delete_day', dayId: firstDayId }] },
    'client',
  )

  expect(next.days).toHaveLength(1)
  expect(next.days[0]?.id).toBe(secondDayId)
  expect(next.days[0]?.order).toBe(1)

  // Строки ушли из базы: день и его упражнения (каскад по внешнему ключу).
  const days = await db.select().from(programDays).where(eq(programDays.programId, program.id))
  expect(days.map((day) => day.id)).toEqual([secondDayId])

  const items = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.dayId, firstDayId))
  expect(items).toEqual([])

  // В истории — понятная строка «Убран день: …».
  const changes = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, program.id))
  const lastDiff = changes.at(-1)?.diff as { text: string }[]
  expect(lastDiff.map((line) => line.text)).toContain('Убран день: День A — спина и бицепс')
})

test('клиент не может менять чужую программу', async () => {
  const program = await copyTemplateToClient(otherClient, templateId, otherClient.id, gymId)

  await expect(
    applyProgramPatchAs(
      client,
      program.id,
      {
        ops: [
          {
            op: 'set_sets_reps',
            programExerciseId: program.days[0]!.exercises[0]!.id,
            sets: 5,
          },
        ],
      },
      'client',
    ),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('тренер с clients.edit_programs (own) правит программу своего клиента', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)

  const next = await applyProgramPatchAs(
    trainer,
    program.id,
    {
      ops: [
        {
          op: 'set_target_weight',
          programExerciseId: program.days[0]!.exercises[0]!.id,
          weightKg: 50,
        },
      ],
    },
    'trainer',
  )

  expect(next.days[0]?.exercises[0]?.targetWeightKg).toBe(50)
})

test('copyTemplateToClient архивирует прежнюю активную программу', async () => {
  const first = await copyTemplateToClient(client, templateId, client.id, gymId)
  const second = await copyTemplateToClient(client, templateId, client.id, gymId)

  const rows = await db.select().from(programs).where(eq(programs.ownerId, client.id))
  expect(rows).toHaveLength(2)
  expect(rows.filter((row) => row.status === 'active')).toHaveLength(1)

  const active = await getActiveProgram(client.id)
  expect(active?.id).toBe(second.id)
  expect(active?.id).not.toBe(first.id)
})

test('два параллельных копирования шаблона оставляют одну активную программу', async () => {
  await Promise.all([
    copyTemplateToClient(client, templateId, client.id, gymId),
    copyTemplateToClient(client, templateId, client.id, gymId),
  ])

  const rows = await db.select().from(programs).where(eq(programs.ownerId, client.id))
  expect(rows.filter((row) => row.status === 'active')).toHaveLength(1)
})

test('два параллельных патча не теряются', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)
  const dayId = program.days[0]!.id

  await Promise.all([
    applyProgramPatchAs(
      client,
      program.id,
      { ops: [{ op: 'add_exercise', dayId, exerciseId: exerciseB, sets: 3, repMin: 10, repMax: 12 }] },
      'client',
    ),
    applyProgramPatchAs(
      client,
      program.id,
      { ops: [{ op: 'add_exercise', dayId, exerciseId: exerciseC, sets: 3, repMin: 10, repMax: 12 }] },
      'client',
    ),
  ])

  const tree = await getActiveProgram(client.id)
  const ids = tree?.days[0]?.exercises.map((item) => item.exerciseId) ?? []
  expect(ids).toContain(exerciseA)
  expect(ids).toContain(exerciseB)
  expect(ids).toContain(exerciseC)
  expect(ids).toHaveLength(3)
})
test('старая запись истории, где diff — объект черновика, читается как одна строка', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)

  // Раньше принятый черновик МаксИИма писал в diff целую программу, а не список строк.
  await db.insert(programChanges).values({
    programId: program.id,
    actorId: null,
    actorKind: 'ai_proposal_accepted',
    diff: { days: [{ name: 'Ноги и пресс', exercises: [] }] },
    before: {},
    after: {},
  })

  const changes = await listProgramChanges(program.id)
  const legacy = changes.find((change) => change.actorKind === 'ai_proposal_accepted')

  expect(Array.isArray(legacy?.diff)).toBe(true)
  expect(legacy?.diff.map((line) => line.text)).toEqual(['Программа составлена МаксИИмом: Ноги и пресс'])
})

test('веса по подходам сохраняются в базе, читаются и переходят в копию шаблона', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)
  const itemId = program.days[0]!.exercises[0]!.id
  const sets = program.days[0]!.exercises[0]!.sets
  const weights = Array.from({ length: sets }, (_, index) => (index === 0 ? 15 : 20))

  await applyProgramPatchAs(
    client,
    program.id,
    { ops: [{ op: 'set_set_weights', programExerciseId: itemId, weights }] },
    'client',
  )

  const [row] = await db.select().from(programExercises).where(eq(programExercises.id, itemId))
  expect(row?.setWeights).toEqual(weights)
  expect(row?.targetWeightKg).toBe(20)

  const active = await getActiveProgram(client.id)
  expect(active?.days[0]?.exercises[0]?.setWeights).toEqual(weights)

  const changes = await listProgramChanges(program.id)
  expect(changes.length).toBeGreaterThan(0)

  // Шаблон с весами по подходам при выдаче клиенту не теряет их.
  await db.update(programExercises).set({ setWeights: weights, targetWeightKg: 20 }).where(
    eq(programExercises.dayId, (await db.select().from(programDays).where(eq(programDays.programId, templateId)).limit(1))[0]!.id),
  )
  const copy = await copyTemplateToClient(client, templateId, client.id, gymId)
  expect(copy.days[0]?.exercises[0]?.setWeights).toEqual(weights)
})
