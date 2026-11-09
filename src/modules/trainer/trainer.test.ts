import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { getClientCard, listClients } from './clients'
import { addNote, listNotes, listVisibleNotes } from './notes'
import { getTrainerFeed } from './feed'
import { resolveFlag } from '@/modules/coach-ai'
import { workoutSessions } from '@/modules/training'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
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

test('тренер с областью own не видит чужого клиента в списке', async () => {
  const own = await listClients(world.otherTrainer)
  expect(own.map((client) => client.id)).toEqual([world.otherClientId])

  const all = await listClients(world.trainer)
  expect(all.map((client) => client.id).sort()).toEqual([world.clientId, world.otherClientId].sort())
})

test('карточка чужого клиента для тренера own — NotFoundError (404), а не данные', async () => {
  await expect(getClientCard(world.otherTrainer, world.clientId)).rejects.toBeInstanceOf(NotFoundError)
})

test('карточка своего клиента отдаёт программу, подписку и права', async () => {
  const card = await getClientCard(world.trainer, world.clientId)

  expect(card.name).toBe('Иван Петров')
  expect(card.program?.days[0]?.exercises).toHaveLength(1)
  expect(card.access.hasAccess).toBe(true)
  expect(card.permissions.editProgram).toBe(true)
  expect(card.programChanges).toHaveLength(0)
})

test('заметка с visibleToClient:false не попадает к клиенту', async () => {
  await addNote(world.trainer, world.clientId, { text: 'Следи за спиной на тяге', visibleToClient: false })
  await addNote(world.trainer, world.clientId, { text: 'Пей воду', visibleToClient: true })

  const forTrainer = await listNotes(world.trainer, world.clientId)
  expect(forTrainer).toHaveLength(2)

  const forClient = await listVisibleNotes(world.clientId)
  expect(forClient.map((note) => note.text)).toEqual(['Пей воду'])
})

test('лента: жалоба видна своему тренеру и исчезает после «Разобрался»', async () => {
  const flagId = await addPainFlag(world.clientId, 'болит колено')

  const feed = await getTrainerFeed(world.trainer)
  expect(feed.painFlags.map((flag) => flag.clientId)).toEqual([world.clientId])
  expect(feed.painFlags[0]?.text).toBe('болит колено')

  const foreign = await getTrainerFeed(world.otherTrainer)
  expect(foreign.painFlags).toHaveLength(0)

  await resolveFlag(world.trainer, flagId)

  const after = await getTrainerFeed(world.trainer)
  expect(after.painFlags).toHaveLength(0)
})

test('лента: тренировка четырёхчасовой давности не «Тренируются сейчас»', async () => {
  await db.insert(workoutSessions).values({
    userId: world.clientId,
    programDayId: null,
    mode: 'free',
    clientUuid: `old-${Date.now()}`,
    startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  })
  await db.insert(workoutSessions).values({
    userId: world.clientId,
    programDayId: null,
    mode: 'free',
    clientUuid: `fresh-${Date.now()}`,
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
  })

  const feed = await getTrainerFeed(world.trainer)
  expect(feed.trainingNow).toHaveLength(1)
  expect(feed.trainingNow[0]?.id).toBe(world.clientId)
})