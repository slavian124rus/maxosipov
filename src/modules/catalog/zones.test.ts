import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { machines, machineZones } from './schema'
import { createMachine } from './service'
import { createZone, deleteZone, ensureZone, listZones, renameZone } from './zones'

let actor: Actor
let client: Actor
let gymId: string

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
  actor = {
    id: '00000000-0000-4000-8000-000000000099',
    roleId: '00000000-0000-4000-8000-000000000001',
    gymId,
    isOwner: false,
    permissions: [{ code: 'catalog.edit', scope: 'all' }],
  }
  client = { ...actor, permissions: [] }
})

test('зона создаётся один раз: повтор не дублирует и не падает', async () => {
  const zone = await createZone(actor, ' Кардио ')
  expect(zone.name).toBe('Кардио')

  // Свободно вписанная зона в форме тренажёра переиспользует существующую.
  const again = await ensureZone('Кардио')
  expect(again?.id).toBe(zone.id)

  await expect(createZone(actor, 'Кардио')).rejects.toThrow('Зона «Кардио» уже есть')
  expect(await listZones()).toHaveLength(1)
})

test('переименование зоны обновляет и тренажёры этой зоны', async () => {
  const zone = await createZone(actor, 'Кардио')
  const treadmill = await createMachine(actor, {
    name: 'Беговая дорожка',
    zone: 'Кардио',
    weightStepKg: 0,
    photoMediaId: null,
  })

  await renameZone(actor, zone.id, 'Кардиозона')

  const [row] = await db.select().from(machines).where(eq(machines.id, treadmill.id))
  expect(row?.zone).toBe('Кардиозона')

  const [zoneRow] = await db.select().from(machineZones).where(eq(machineZones.id, zone.id))
  expect(zoneRow?.name).toBe('Кардиозона')

  const zones = await listZones()
  expect(zones.map((item) => [item.name, item.machineCount])).toEqual([['Кардиозона', 1]])
})

test('переименование в занятое имя — отказ', async () => {
  const cardio = await createZone(actor, 'Кардио')
  await createZone(actor, 'Ноги')

  await expect(renameZone(actor, cardio.id, 'Ноги')).rejects.toThrow('Зона «Ноги» уже есть')
})

test('зону с тренажёрами удалить нельзя, пустую — можно', async () => {
  const zone = await createZone(actor, 'Кардио')
  const machine = await createMachine(actor, {
    name: 'Велотренажёр',
    zone: 'Кардио',
    weightStepKg: 0,
    photoMediaId: null,
  })

  await expect(deleteZone(actor, zone.id)).rejects.toThrow(
    'В зоне «Кардио» есть тренажёры: 1. Сначала перенеси их в другую зону',
  )

  // Перенесли тренажёр в другую зону — зона освободилась.
  const legs = await createZone(actor, 'Ноги')
  await db.update(machines).set({ zone: 'Ноги' }).where(eq(machines.id, machine.id))

  await deleteZone(actor, zone.id)
  expect(await listZones()).toEqual([expect.objectContaining({ id: legs.id, machineCount: 1 })])
})

test('счётчик в зоне не учитывает архивные тренажёры', async () => {
  const zone = await createZone(actor, 'Кардио')
  const machine = await createMachine(actor, {
    name: 'Старая дорожка',
    zone: 'Кардио',
    weightStepKg: 0,
    photoMediaId: null,
  })
  await db.update(machines).set({ archivedAt: new Date() }).where(eq(machines.id, machine.id))

  expect((await listZones())[0]).toMatchObject({ id: zone.id, machineCount: 0 })
})

test('тренажёр с весом 0 (кардио) сохраняется', async () => {
  const machine = await createMachine(actor, {
    name: 'Эллипс',
    zone: 'Кардио',
    weightStepKg: 0,
    photoMediaId: null,
  })

  expect(machine.weightStepKg).toBe(0)
  // Зона из формы попала в справочник.
  expect((await listZones()).map((zone) => zone.name)).toEqual(['Кардио'])
})

test('зона, вписанная у тренажёра раньше справочника, появляется в настройках сама', async () => {
  // Тренажёр с зоной «Спина» есть, а записи в machine_zones нет — как на проде,
  // где миграцию применили, но сид с бэкфиллом не прогоняли.
  await db.insert(machines).values({ gymId, name: 'Рычажная тяга', zone: 'Спина' })

  expect(await listZones()).toEqual([expect.objectContaining({ name: 'Спина', machineCount: 1 })])

  // Зона дорегистрирована — её можно переименовать и удалить как обычную.
  const [row] = await db.select().from(machineZones).where(eq(machineZones.name, 'Спина'))
  expect(row?.gymId).toBe(gymId)
})

test('зоны меняет только тот, у кого есть catalog.edit', async () => {
  const zone = await createZone(actor, 'Кардио')

  await expect(createZone(client, 'Ноги')).rejects.toBeInstanceOf(ForbiddenError)
  await expect(renameZone(client, zone.id, 'Ноги')).rejects.toBeInstanceOf(ForbiddenError)
  await expect(deleteZone(client, zone.id)).rejects.toBeInstanceOf(ForbiddenError)
})
