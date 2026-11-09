import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import type { Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { applyProgramPatchAs, copyTemplateToClient, getActiveProgram, getProgramTree } from './programs'
import { REVERT_CONFLICT, revertChange, saveAsTemplate } from './revert'
import { aiProposals, programChanges, programDays, programExercises, programs } from './schema'

let gymId: string
let client: Actor
let trainerId: string
let trainer: Actor
let templateId: string
let exerciseA: string
let exerciseB: string

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

  client = { id: clientRow!.id, roleId: roles['Клиент']!.id, gymId, isOwner: false, permissions: [] }
  trainer = {
    id: trainerId,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'all' }],
  }

  exerciseA = await addExercise('Тяга верхнего блока')
  exerciseB = await addExercise('Тяга горизонтального блока')

  const [template] = await db
    .insert(programs)
    .values({ gymId, ownerId: null, authorId: trainerId, authorKind: 'trainer', name: 'Старт: 3 дня' })
    .returning()
  templateId = template!.id

  const [day] = await db
    .insert(programDays)
    .values({ programId: templateId, order: 1, name: 'День A' })
    .returning()

  await db.insert(programExercises).values({
    dayId: day!.id,
    order: 1,
    exerciseId: exerciseA,
    sets: 3,
    repMin: 10,
    repMax: 12,
    restSec: 90,
  })
})

/** Программа клиента + изменение МаксИИма в ней. */
async function programWithAiChange(): Promise<{ programId: string; changeId: string }> {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)
  const dayId = program.days[0]!.id

  await applyProgramPatchAs(
    trainer,
    program.id,
    {
      ops: [
        { op: 'add_exercise', dayId, exerciseId: exerciseB, sets: 3, repMin: 10, repMax: 12 },
      ],
    },
    'ai_proposal_accepted',
  )

  const [change] = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, program.id))
    .orderBy(programChanges.createdAt)

  return { programId: program.id, changeId: change!.id }
}

test('откат последнего изменения МаксИИма возвращает программу к снимку before', async () => {
  const { programId, changeId } = await programWithAiChange()

  await db.insert(aiProposals).values({
    userId: client.id,
    programId,
    kind: 'patch',
    diff: { ops: [] },
    status: 'accepted',
  })

  const before = await getProgramTree(programId)
  expect(before?.days[0]?.exercises).toHaveLength(2)

  await revertChange(trainer, changeId)

  const after = await getActiveProgram(client.id)
  expect(after?.days[0]?.exercises).toHaveLength(1)
  expect(after?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseA)

  const [proposal] = await db.select().from(aiProposals).where(eq(aiProposals.programId, programId))
  expect(proposal?.status).toBe('reverted')

  const changes = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, programId))
  expect(changes.some((row) => row.actorKind === 'trainer')).toBe(true)
})

test('откат не последнего изменения — понятная ошибка, программа не меняется', async () => {
  const { programId, changeId } = await programWithAiChange()

  // Тренер уже поправил программу после изменения ИИ.
  const tree = await getProgramTree(programId)
  await applyProgramPatchAs(
    trainer,
    programId,
    { ops: [{ op: 'set_sets_reps', programExerciseId: tree!.days[0]!.exercises[0]!.id, sets: 4 }] },
    'trainer',
  )

  const snapshot = await getProgramTree(programId)

  await expect(revertChange(trainer, changeId)).rejects.toThrow(REVERT_CONFLICT)

  const after = await getProgramTree(programId)
  expect(after?.days[0]?.exercises[0]?.sets).toBe(snapshot?.days[0]?.exercises[0]?.sets)
  expect(after?.days[0]?.exercises).toHaveLength(2)
})

test('saveAsTemplate копирует дерево в шаблон зала', async () => {
  const program = await copyTemplateToClient(client, templateId, client.id, gymId)

  const newTemplateId = await saveAsTemplate(trainer, program.id, 'Ноги и спина')
  const tree = await getProgramTree(newTemplateId)

  expect(tree?.ownerId).toBeNull()
  expect(tree?.name).toBe('Ноги и спина')
  expect(tree?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseA)
})