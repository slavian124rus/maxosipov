import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { listAlternatives, setAlternatives, suggestAlternatives } from './alternatives'
import { exercises, machines } from './schema'

let owner: Actor
let client: Actor
let ids: Record<string, string>

async function addExercise(
  key: string,
  values: { machine: string | null; primary: string[]; status?: 'published' | 'draft'; archived?: boolean },
) {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId: owner.gymId,
      slug: key,
      name: key,
      machineId: values.machine,
      primaryMuscles: values.primary,
      secondaryMuscles: [],
      status: values.status ?? 'published',
      archivedAt: values.archived ? new Date() : null,
      steps: ['шаг'],
    } as typeof exercises.$inferInsert)
    .returning()
  ids[key] = row!.id
}

beforeAll(async () => {
  await prepareTestDb()
})
afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  ids = {}

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

  const [a, b, c] = await db
    .insert(machines)
    .values([
      { gymId: gym!.id, name: 'Блок А', zone: 'Тренажёры', weightStepKg: 5 },
      { gymId: gym!.id, name: 'Блок Б', zone: 'Тренажёры', weightStepKg: 5 },
      { gymId: gym!.id, name: 'Рычаг В', zone: 'Тренажёры', weightStepKg: 5 },
    ] as (typeof machines.$inferInsert)[])
    .returning()

  await addExercise('lat-pulldown', { machine: a!.id, primary: ['lats'] })
  await addExercise('lat-row', { machine: b!.id, primary: ['lats'] })
  await addExercise('lever-row', { machine: c!.id, primary: ['lats', 'traps-middle'] })
  await addExercise('same-machine', { machine: a!.id, primary: ['lats'] })
  await addExercise('chest-press', { machine: b!.id, primary: ['chest'] })
  await addExercise('draft-row', { machine: b!.id, primary: ['lats'], status: 'draft' })
  await addExercise('old-row', { machine: c!.id, primary: ['lats'], archived: true })
})

test('suggest: другие тренажёры с теми же основными мышцами, лучшее совпадение первым', async () => {
  const result = await suggestAlternatives(ids['lat-pulldown']!)
  expect(result.map((item) => item.name)).toEqual(['lat-row', 'lever-row'])
})

test('suggest: не предлагает уже выбранное, черновики, архив и тот же тренажёр', async () => {
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lat-row']!])
  const result = await suggestAlternatives(ids['lat-pulldown']!)
  expect(result.map((item) => item.name)).toEqual(['lever-row'])
})

test('set + list: порядок сохраняется, черновики и архив не показываются клиенту', async () => {
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lever-row']!, ids['draft-row']!, ids['old-row']!, ids['lat-row']!])
  const result = await listAlternatives(ids['lat-pulldown']!)
  expect(result.map((item) => item.name)).toEqual(['lever-row', 'lat-row'])
})

test('set: повторный вызов заменяет список целиком', async () => {
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lat-row']!, ids['lever-row']!])
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lever-row']!])
  expect((await listAlternatives(ids['lat-pulldown']!)).map((item) => item.name)).toEqual(['lever-row'])
})

test('set: сам на себя ссылаться нельзя', async () => {
  await expect(setAlternatives(owner, ids['lat-pulldown']!, [ids['lat-pulldown']!])).rejects.toThrow(/сам/i)
})

test('set с mirror: связь появляется и в обратную сторону, без дублей', async () => {
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lat-row']!], { mirror: true })
  await setAlternatives(owner, ids['lat-pulldown']!, [ids['lat-row']!], { mirror: true })
  expect((await listAlternatives(ids['lat-row']!)).map((item) => item.name)).toEqual(['lat-pulldown'])
})

test('set: без права catalog.edit — отказ', async () => {
  await expect(setAlternatives(client, ids['lat-pulldown']!, [ids['lat-row']!])).rejects.toBeInstanceOf(ForbiddenError)
})
