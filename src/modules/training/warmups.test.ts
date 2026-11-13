import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { warmupSeconds } from './warmup'
import {
  archiveWarmupTemplate,
  getWarmupFor,
  listWarmupTemplates,
  saveWarmupTemplate,
} from './warmups'

let owner: Actor
let client: Actor

beforeAll(async () => {
  await prepareTestDb()
})
afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск',
      brand: { name: 'Максим', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 },
        aiMemo: '',
      },
    })
    .returning()
  owner = {
    id: '00000000-0000-4000-8000-000000000010',
    roleId: '00000000-0000-4000-8000-000000000001',
    gymId: gym!.id,
    isOwner: true,
    permissions: [],
  }
  client = { ...owner, id: '00000000-0000-4000-8000-000000000011', isOwner: false }
})

test('у нового зала сразу есть три шаблона по 5–7 минут: ноги, верх, всё тело', async () => {
  const list = await listWarmupTemplates(owner.gymId)
  expect(list.map((t) => t.focus).sort()).toEqual(['full', 'legs', 'upper'])
  for (const template of list) {
    const minutes = warmupSeconds(template.items) / 60
    expect(minutes).toBeGreaterThanOrEqual(5)
    expect(minutes).toBeLessThanOrEqual(7)
  }
})

test('шаблоны по умолчанию не создаются повторно', async () => {
  await listWarmupTemplates(owner.gymId)
  await listWarmupTemplates(owner.gymId)
  expect(await listWarmupTemplates(owner.gymId)).toHaveLength(3)
})

test('getWarmupFor возвращает шаблон нужного типа дня', async () => {
  const legs = await getWarmupFor(owner.gymId, 'legs')
  expect(legs?.focus).toBe('legs')
})

test('сохранение: создаёт и обновляет шаблон', async () => {
  const created = await saveWarmupTemplate(owner, {
    name: 'Свои ноги',
    focus: 'legs',
    items: [{ title: 'Бег', exerciseId: null, durationSec: 300, reps: null, note: null, zones: [] }],
  })
  const updated = await saveWarmupTemplate(owner, { ...created, name: 'Свои ноги 2', items: created.items })
  expect(updated.id).toBe(created.id)
  expect(updated.name).toBe('Свои ноги 2')
})

test('сохранение: пустое название и пункт без времени и повторений отклоняются', async () => {
  await expect(
    saveWarmupTemplate(owner, { name: ' ', focus: 'full', items: [] }),
  ).rejects.toThrow()
  await expect(
    saveWarmupTemplate(owner, {
      name: 'Плохой',
      focus: 'full',
      items: [{ title: 'Ничего', exerciseId: null, durationSec: null, reps: null, note: null, zones: [] }],
    }),
  ).rejects.toThrow(/время|повтор/i)
})

test('архив: шаблон исчезает из списка, дефолты не воскресают', async () => {
  const list = await listWarmupTemplates(owner.gymId)
  await archiveWarmupTemplate(owner, list[0]!.id)
  expect(await listWarmupTemplates(owner.gymId)).toHaveLength(2)
})

test('клиент не может менять шаблоны', async () => {
  await expect(
    saveWarmupTemplate(client, { name: 'x', focus: 'full', items: [] }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})
