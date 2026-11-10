import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { users } from '@/modules/auth'
import { gyms } from '@/modules/gym'
import { notifications } from '@/modules/notifications'
import { ForbiddenError, loadActor, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { createLead, LEADS_PER_HOUR, listLeads, markLeadContacted, type CreateLeadInput } from './leads'
import { leads, type Lead } from './schema'

const IP = '95.110.20.30'
const OTHER_IP = '95.110.20.31'

type World = {
  gymId: string
  owner: Actor
  trainer: Actor
  admin: Actor
  client: Actor
  clientId: string
}

/** Стенд: зал и четыре человека — владелец, главный тренер, администратор, клиент. */
async function setupWorld(): Promise<World> {
  const roleRows = await seedDefaultRoles()

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

  const add = async (phone: string, name: string, roleName: string): Promise<string> => {
    const [row] = await db
      .insert(users)
      .values({ phone, name, gymId: gym!.id, roleId: roleRows[roleName]!.id })
      .returning()
    return row!.id
  }

  const ownerId = await add('+79990000001', 'Владелец', 'Владелец')
  const trainerId = await add('+79990000002', 'Максим', 'Главный тренер')
  const adminId = await add('+79990000003', 'Администратор', 'Администратор зала')
  const clientId = await add('+79990000011', 'Иван Петров', 'Клиент')

  return {
    gymId: gym!.id,
    owner: await loadActor(ownerId),
    trainer: await loadActor(trainerId),
    admin: await loadActor(adminId),
    client: await loadActor(clientId),
    clientId,
  }
}

/** Заявка из формы: строки и «сырой» телефон, как его вводит человек. */
function leadInput(over: Partial<CreateLeadInput> = {}): CreateLeadInput {
  return {
    name: 'Иван',
    phone: '8 (999) 000-00-99',
    consent: true,
    ip: IP,
    source: 'landing',
    ...over,
  }
}

/** Заявка в обход сервиса — нужна, чтобы проверить окна времени. */
async function insertLead(phone: string, ip: string, createdAt: Date): Promise<void> {
  await db.insert(leads).values({
    name: 'Старая заявка',
    phone,
    source: 'landing',
    ip,
    consentAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  })
}

async function allLeads(): Promise<Lead[]> {
  return db.select().from(leads)
}

/** Валидный тестовый номер: 11 цифр, национальная часть начинается с 9. */
function phoneFor(index: number): string {
  return `+7999000${String(index).padStart(4, '0')}`
}

let world: World

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  world = await setupWorld()
})

test('заявка сохраняется: телефон в E.164, IP и время согласия', async () => {
  const now = new Date('2026-11-10T10:00:00Z')
  const result = await createLead(leadInput({ name: '  Иван   Петров  ' }), now)

  expect(result).toEqual({ ok: true })

  const rows = await allLeads()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ name: 'Иван Петров', phone: '+79990000099', ip: IP, source: 'landing' })
  expect(rows[0]!.consentAt.toISOString()).toBe(now.toISOString())
  expect(rows[0]!.contactedAt).toBeNull()
})

test('невалидный телефон → «Проверь номер», записи нет', async () => {
  for (const phone of ['123', '+1 (555) 000-00-00', 'не номер']) {
    expect(await createLead(leadInput({ phone })), phone).toEqual({ ok: false, error: 'Проверь номер' })
  }

  expect(await allLeads()).toHaveLength(0)
})

test('без согласия → «Нужно согласие на обработку данных»', async () => {
  expect(await createLead(leadInput({ consent: false }))).toEqual({
    ok: false,
    error: 'Нужно согласие на обработку данных',
  })
  expect(await allLeads()).toHaveLength(0)
})

test('имя короче 2 или длиннее 60 символов → понятная ошибка', async () => {
  const error = { ok: false, error: 'Проверь имя: от 2 до 60 символов' }

  expect(await createLead(leadInput({ name: 'И' }))).toEqual(error)
  expect(await createLead(leadInput({ name: 'а'.repeat(61) }))).toEqual(error)
  expect(await createLead(leadInput({ name: '   ' }))).toEqual(error)
  expect(await allLeads()).toHaveLength(0)
})

test('дубль того же номера за 10 минут → ok и одна запись', async () => {
  const now = new Date('2026-11-10T10:00:00Z')

  expect(await createLead(leadInput(), now)).toEqual({ ok: true })
  // Второй тап по «Отправить» через 5 минут и с другим именем — это тот же человек.
  expect(
    await createLead(leadInput({ name: 'Ваня' }), new Date(now.getTime() + 5 * 60 * 1000)),
  ).toEqual({ ok: true })

  const rows = await allLeads()
  expect(rows).toHaveLength(1)
  expect(rows[0]!.name).toBe('Иван')
})

test('дубль старше 10 минут → новая заявка', async () => {
  const now = new Date('2026-11-10T10:00:00Z')
  await insertLead('+79990000099', IP, new Date(now.getTime() - 11 * 60 * 1000))

  expect(await createLead(leadInput(), now)).toEqual({ ok: true })
  expect(await allLeads()).toHaveLength(2)
})

test('6-я заявка с IP за час → «Слишком много заявок, попробуй позже»', async () => {
  const now = new Date('2026-11-10T10:00:00Z')

  for (let index = 0; index < LEADS_PER_HOUR; index += 1) {
    expect(await createLead(leadInput({ phone: phoneFor(100 + index) }), now), `заявка ${index + 1}`).toEqual({
      ok: true,
    })
  }

  expect(await createLead(leadInput({ phone: phoneFor(199) }), now)).toEqual({
    ok: false,
    error: 'Слишком много заявок, попробуй позже',
  })
  expect(await allLeads()).toHaveLength(LEADS_PER_HOUR)
})

test('лимит считается по IP: час прошёл или адрес другой — заявка проходит', async () => {
  const now = new Date('2026-11-10T10:00:00Z')

  for (let index = 0; index < LEADS_PER_HOUR; index += 1) {
    await insertLead(phoneFor(200 + index), IP, now)
  }

  // Тот же IP, но уже за пределами часового окна.
  expect(
    await createLead(leadInput({ phone: phoneFor(300) }), new Date(now.getTime() + 61 * 60 * 1000)),
  ).toEqual({ ok: true })
  // Другой IP в то же время.
  expect(await createLead(leadInput({ phone: phoneFor(301), ip: OTHER_IP }), now)).toEqual({ ok: true })
})

test('параллельные отправки с одного IP не обходят лимит (двойное нажатие)', async () => {
  const results = await Promise.all(
    Array.from({ length: LEADS_PER_HOUR + 3 }, (_, index) =>
      createLead(leadInput({ phone: phoneFor(400 + index) })),
    ),
  )

  expect(results.filter((result) => result.ok)).toHaveLength(LEADS_PER_HOUR)
  expect(results.filter((result) => !result.ok)).toHaveLength(3)
  expect(await allLeads()).toHaveLength(LEADS_PER_HOUR)
})

test('уведомление new_lead уходит сотрудникам с clients.view и не уходит клиенту', async () => {
  expect(await createLead(leadInput())).toEqual({ ok: true })

  const rows = await db.select().from(notifications)
  expect(rows).toHaveLength(3)
  expect(rows.every((row) => row.kind === 'new_lead')).toBe(true)
  expect(rows.map((row) => row.userId)).not.toContain(world.clientId)
  expect(rows[0]!.payload).toEqual({ name: 'Иван', phone: '+79990000099' })
})

test('сбой уведомления не мешает сохранить заявку', async () => {
  // Зала нет — прочитать адресатов нельзя, но заявка человека должна остаться.
  await db.delete(gyms)

  expect(await createLead(leadInput())).toEqual({ ok: true })
  expect(await allLeads()).toHaveLength(1)
  expect(await db.select().from(notifications)).toHaveLength(0)
})

test('список заявок: только с правом clients.view, новые сверху', async () => {
  const now = new Date('2026-11-10T10:00:00Z')
  await insertLead('+79990000501', IP, now)
  await insertLead('+79990000502', IP, new Date(now.getTime() + 60 * 60 * 1000))

  const rows = await listLeads(world.trainer)
  expect(rows.map((row) => row.phone)).toEqual(['+79990000502', '+79990000501'])

  await expect(listLeads(world.client)).rejects.toBeInstanceOf(ForbiddenError)
})

test('«Связался» ставится один раз и требует права', async () => {
  await createLead(leadInput())
  const [lead] = await allLeads()

  const first = new Date('2026-11-10T12:00:00Z')
  await markLeadContacted(world.trainer, lead!.id, first)
  await markLeadContacted(world.trainer, lead!.id, new Date('2026-11-11T09:00:00Z'))

  const [updated] = await allLeads()
  expect(updated!.contactedAt?.toISOString()).toBe(first.toISOString())

  await expect(markLeadContacted(world.client, lead!.id)).rejects.toBeInstanceOf(ForbiddenError)
})
