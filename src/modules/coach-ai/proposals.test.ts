import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { addDays, subscriptions } from '@/modules/access'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import {
  aiProposals,
  getActiveProgram,
  getProgramTree,
  programChanges,
  programDays,
  programExercises,
  programs,
} from '@/modules/training'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { acceptProposal, rejectProposal } from './proposals'

let gymId: string
let client: Actor
let otherClient: Actor
let programId: string
let programExerciseId: string
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
      brand: {
        name: 'Максим Осипов',
        shortName: 'МаксИИм',
        colors: { accent: '#E5322D' },
        logoUrl: null,
      },
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

  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId: trainer!.id,
    })
    .returning()

  await db.insert(subscriptions).values({
    userId: clientRow!.id,
    status: 'trial',
    startsAt: new Date(),
    endsAt: addDays(new Date(), 30),
  })

  const [otherRow] = await db
    .insert(users)
    .values({ phone: '+79990000012', name: 'Другой', gymId, roleId: roles['Клиент']!.id })
    .returning()

  client = {
    id: clientRow!.id,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }
  otherClient = {
    id: otherRow!.id,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }

  exerciseA = await addExercise('Тяга верхнего блока')
  exerciseB = await addExercise('Тяга горизонтального блока')

  const [program] = await db
    .insert(programs)
    .values({
      gymId,
      ownerId: client.id,
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
    .values({
      dayId: day!.id,
      order: 1,
      exerciseId: exerciseA,
      sets: 3,
      repMin: 10,
      repMax: 12,
      restSec: 90,
    })
    .returning()
  programExerciseId = item!.id
})
async function createPatchProposal(): Promise<string> {
  const [row] = await db
    .insert(aiProposals)
    .values({
      userId: client.id,
      programId,
      kind: 'patch',
      diff: { ops: [] },
      payload: { ops: [{ op: 'replace_exercise', programExerciseId, exerciseId: exerciseB }] },
      rationale: 'Замена',
    })
    .returning({ id: aiProposals.id })
  return row!.id
}

test('принятие патча меняет программу и пишет историю с actor_kind=ai_proposal_accepted', async () => {
  const proposalId = await createPatchProposal()

  await acceptProposal(client, proposalId)

  const program = await getProgramTree(programId)
  expect(program?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseB)

  const changes = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, programId))
  expect(changes).toHaveLength(1)
  expect(changes[0]?.actorKind).toBe('ai_proposal_accepted')

  const [proposal] = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId))
  expect(proposal?.status).toBe('accepted')
  expect(proposal?.decidedBy).toBe(client.id)
  expect(proposal?.trainerSeenAt).toBeNull()
})

test('принятие new_program делает программу активной, прежнюю — в архив', async () => {
  const [row] = await db
    .insert(aiProposals)
    .values({
      userId: client.id,
      programId,
      kind: 'new_program',
      diff: { name: 'Спина' },
      payload: {
        name: 'Спина',
        days: [
          {
            name: 'День 1',
            exercises: [{ exerciseId: exerciseB, sets: 4, repMin: 8, repMax: 10 }],
          },
        ],
        rationale: 'Новая программа',
      },
    })
    .returning({ id: aiProposals.id })

  await acceptProposal(client, row!.id)

  const active = await getActiveProgram(client.id)
  expect(active?.name).toBe('Спина')
  expect(active?.authorKind).toBe('client_ai')
  expect(active?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseB)

  const rows = await db.select().from(programs).where(eq(programs.ownerId, client.id))
  expect(rows.filter((item) => item.status === 'active')).toHaveLength(1)
  expect(rows.filter((item) => item.status === 'archived')).toHaveLength(1)
})

test('повторное решение — «Уже решено»', async () => {
  const proposalId = await createPatchProposal()
  await acceptProposal(client, proposalId)

  await expect(acceptProposal(client, proposalId)).rejects.toThrow('Уже решено')
  await expect(rejectProposal(client, proposalId)).rejects.toThrow('Уже решено')
})

test('чужой клиент не может принять предложение', async () => {
  const proposalId = await createPatchProposal()

  await expect(acceptProposal(otherClient, proposalId)).rejects.toBeInstanceOf(ForbiddenError)
})

test('отклонение не меняет программу', async () => {
  const proposalId = await createPatchProposal()
  await rejectProposal(client, proposalId)

  const program = await getProgramTree(programId)
  expect(program?.days[0]?.exercises[0]?.exerciseId).toBe(exerciseA)
})

test('без действующей подписки принять предложение нельзя, оно остаётся pending', async () => {
  const proposalId = await createPatchProposal()
  await db.update(subscriptions).set({ endsAt: new Date(Date.now() - 86400000) })

  await expect(acceptProposal(client, proposalId)).rejects.toBeInstanceOf(ForbiddenError)

  const [row] = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId))
  expect(row?.status).toBe('pending')
})
