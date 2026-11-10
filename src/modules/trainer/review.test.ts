import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { subscriptions } from '@/modules/access'
import { markProposalSeen, resolveFlag } from '@/modules/coach-ai'
import { aiProposals, programs } from '@/modules/training'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { getClientCard } from './clients'
import { getTrainerFeed } from './feed'
import { addNote, listNotes } from './notes'
import { addPainFlag, setupTrainerWorld, type TrainerWorld } from './test-setup'

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

/** Программа тренера у клиента `ownerId` и `count` принятых предложений МаксИИма к ней. */
async function acceptedProposals(
  ownerId: string,
  count: number,
  createdAt: Date,
): Promise<string[]> {
  const [program] = await db
    .insert(programs)
    .values({
      gymId: world.gymId,
      ownerId,
      authorId: world.trainerId,
      authorKind: 'trainer',
      name: `Программа ${ownerId.slice(0, 4)}`,
      status: ownerId === world.clientId ? 'archived' : 'active',
    })
    .returning({ id: programs.id })

  const ids: string[] = []
  for (let index = 0; index < count; index += 1) {
    const [proposal] = await db
      .insert(aiProposals)
      .values({
        userId: ownerId,
        programId: program!.id,
        kind: 'patch',
        diff: { ops: [] },
        payload: { ops: [] },
        status: 'accepted',
        createdAt: new Date(createdAt.getTime() - index * 1000),
      })
      .returning({ id: aiProposals.id })
    ids.push(proposal!.id)
  }

  return ids
}

test('лента: принятые изменения — область прав применяется до limit, свои не вытесняются чужими', async () => {
  // 25 свежих изменений у клиента главного тренера и одно старое — у клиента другого тренера.
  await acceptedProposals(world.clientId, 25, new Date())
  const [ownId] = await acceptedProposals(world.otherClientId, 1, new Date(Date.now() - 60 * 60 * 1000))

  const own = await getTrainerFeed(world.otherTrainer)
  expect(own.acceptedAiChanges.map((item) => item.id)).toEqual([ownId])
  expect(own.acceptedAiChanges[0]?.clientId).toBe(world.otherClientId)

  // Главный тренер видит всех, но не больше 20 в ленте.
  const all = await getTrainerFeed(world.trainer)
  expect(all.acceptedAiChanges).toHaveLength(20)
})

test('«Понятно» убирает принятое изменение из ленты, чужое изменение отметить нельзя (404)', async () => {
  const [mine] = await acceptedProposals(world.clientId, 1, new Date())

  await expect(markProposalSeen(world.otherTrainer, mine!)).rejects.toBeInstanceOf(NotFoundError)
  expect((await getTrainerFeed(world.trainer)).acceptedAiChanges).toHaveLength(1)

  await markProposalSeen(world.trainer, mine!)
  expect((await getTrainerFeed(world.trainer)).acceptedAiChanges).toHaveLength(0)
})

test('«Разобрался» по чужой жалобе — 404, жалоба остаётся', async () => {
  const flagId = await addPainFlag(world.clientId, 'болит колено')

  await expect(resolveFlag(world.otherTrainer, flagId)).rejects.toBeInstanceOf(NotFoundError)
  expect((await getTrainerFeed(world.trainer)).painFlags).toHaveLength(1)
})

test('лента: «Заканчивается доступ» — только trial и active, замороженная подписка не в счёт', async () => {
  const now = new Date()
  await db
    .update(subscriptions)
    .set({ status: 'frozen', endsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) })
    .where(eq(subscriptions.userId, world.clientId))
  await db
    .update(subscriptions)
    .set({ endsAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) })
    .where(eq(subscriptions.userId, world.otherClientId))

  const feed = await getTrainerFeed(world.trainer, now)
  expect(feed.expiringSoon.map((item) => item.clientId)).toEqual([world.otherClientId])
})

test('заметки приватны: без права clients.notes их не видно ни в списке, ни в карточке', async () => {
  await addNote(world.trainer, world.clientId, { text: 'Боится приседаний', visibleToClient: false })

  const viewer: Actor = {
    id: world.trainerId,
    roleId: world.trainer.roleId,
    gymId: world.gymId,
    isOwner: false,
    permissions: [{ code: 'clients.view', scope: 'all' }],
  }

  await expect(listNotes(viewer, world.clientId)).rejects.toBeInstanceOf(ForbiddenError)

  const card = await getClientCard(viewer, world.clientId)
  expect(card.permissions.notes).toBe(false)
  expect(card.notes).toEqual([])

  const full = await getClientCard(world.trainer, world.clientId)
  expect(full.notes).toHaveLength(1)
})
