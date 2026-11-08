import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import type { SubscriptionRow } from './compute'
import { subscriptionEvents, subscriptions, trialRegistry } from './schema'
import {
  disable,
  expireSubscriptions,
  freeze,
  getAccessForUser,
  grant,
  startTrialIfEligible,
  unfreeze,
} from './service'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-07T09:00:00Z')

let owner: Actor
let trainer: Actor
let otherTrainer: Actor
let client: Actor
let clientId: string
let otherClientId: string

async function createUser(
  phone: string,
  roleId: string,
  gymId: string,
  trainerId: string | null,
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({ phone, name: phone, gymId, roleId, trainerId })
    .returning({ id: users.id })
  return row!.id
}

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
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

  const gymId = gym!.id
  const ownerId = await createUser('+79990000001', roles['Владелец']!.id, gymId, null)
  const trainerId = await createUser('+79990000002', roles['Главный тренер']!.id, gymId, null)
  const otherTrainerId = await createUser('+79990000003', roles['Тренер']!.id, gymId, null)

  clientId = await createUser('+79990000011', roles['Клиент']!.id, gymId, trainerId)
  otherClientId = await createUser('+79990000012', roles['Клиент']!.id, gymId, otherTrainerId)

  owner = { id: ownerId, roleId: roles['Владелец']!.id, gymId, isOwner: true, permissions: [] }
  trainer = {
    id: trainerId,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'subscriptions.grant', scope: 'own' }],
  }
  otherTrainer = {
    id: otherTrainerId,
    roleId: roles['Тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'subscriptions.grant', scope: 'own' }],
  }
  client = { id: clientId, roleId: roles['Клиент']!.id, gymId, isOwner: false, permissions: [] }
})

async function currentSub(userId: string): Promise<SubscriptionRow> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId))
  return row!
}

test('новый номер получает пробный период 30 дней и запись в trial_registry', async () => {
  expect(await startTrialIfEligible(clientId, '+79990000011')).toBe(true)

  const row = await currentSub(clientId)
  expect(row.status).toBe('trial')
  expect(row.endsAt.toISOString()).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString())

  expect(await db.select().from(trialRegistry)).toHaveLength(1)
  const events = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.userId, clientId))
  expect(events.map((event) => event.type)).toEqual(['trial_started'])
})

test('второй раз пробный период не выдаётся даже другому пользователю', async () => {
  await startTrialIfEligible(clientId, '+79990000011')

  const [source] = await db.select().from(users).where(eq(users.id, clientId))
  const secondUserId = await createUser('+79990000013', source!.roleId, source!.gymId, null)

  expect(await startTrialIfEligible(secondUserId, '+79990000011')).toBe(false)
  expect(await db.select().from(subscriptions)).toHaveLength(1)
})

test('grant +1 месяц при пробном периоде продлевает от текущего конца', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  const before = await currentSub(clientId)

  const granted = await grant(trainer, clientId, { months: 1, priceRub: 3000, note: 'оплатил' })

  const expected = new Date(before.endsAt)
  expected.setUTCMonth(expected.getUTCMonth() + 1)
  expect(granted.endsAt.toISOString()).toBe(expected.toISOString())
  expect(granted.status).toBe('active')

  const events = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.userId, clientId))
  const last = events[events.length - 1]!
  expect(last.type).toBe('granted')
  expect(last.months).toBe(1)
  expect(last.priceRub).toBe(3000)
  expect(last.actorId).toBe(trainer.id)
})

test('grant +1 месяц при истёкшей подписке считается от сегодня', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  await db
    .update(subscriptions)
    .set({ status: 'expired', endsAt: new Date(NOW.getTime() - 20 * DAY) })
    .where(eq(subscriptions.userId, clientId))

  const granted = await grant(owner, clientId, { months: 1 })

  const expected = new Date(NOW)
  expected.setUTCMonth(expected.getUTCMonth() + 1)
  expect(granted.endsAt.toISOString()).toBe(expected.toISOString())
})

test('заморозка и разморозка не съедают дни', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  const before = await currentSub(clientId)

  vi.setSystemTime(new Date('2026-12-01T09:00:00Z'))
  const frozen = await freeze(trainer, clientId)
  expect(frozen.status).toBe('frozen')
  expect(frozen.statusBeforeFreeze).toBe('trial')

  vi.setSystemTime(new Date('2026-12-11T09:00:00Z'))
  const unfrozen = await unfreeze(trainer, clientId)

  expect(unfrozen.status).toBe('trial')
  expect(unfrozen.endsAt.toISOString()).toBe(
    new Date(before.endsAt.getTime() + 10 * DAY).toISOString(),
  )
})

test('клиент не может выдать подписку', async () => {
  await expect(grant(client, clientId, { months: 1 })).rejects.toBeInstanceOf(ForbiddenError)
})

test('тренер с областью own не может выдать подписку чужому клиенту', async () => {
  await expect(grant(otherTrainer, clientId, { months: 1 })).rejects.toBeInstanceOf(ForbiddenError)
})

test('disable отключает доступ', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  const disabled = await disable(trainer, clientId)
  expect(disabled.status).toBe('disabled')
  expect((await getAccessForUser(clientId)).hasAccess).toBe(false)
})

test('expireSubscriptions переводит только просроченные', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  await startTrialIfEligible(otherClientId, '+79990000012')

  await db
    .update(subscriptions)
    .set({ endsAt: new Date(NOW.getTime() - DAY) })
    .where(eq(subscriptions.userId, clientId))

  expect(await expireSubscriptions(new Date(NOW))).toBe(1)
  expect((await currentSub(clientId)).status).toBe('expired')
  expect((await currentSub(otherClientId)).status).toBe('trial')
})

test('getAccessForUser: владелец и тренер — bypass, клиент — нет', async () => {
  await startTrialIfEligible(clientId, '+79990000011')

  expect((await getAccessForUser(owner.id)).bypass).toBe(true)
  expect((await getAccessForUser(trainer.id)).bypass).toBe(true)

  const clientAccess = await getAccessForUser(clientId)
  expect(clientAccess.bypass).toBe(false)
  expect(clientAccess.hasAccess).toBe(true)
})

test('assertClientAccess: без подписки — ForbiddenError, с подпиской и тренеру — проходит', async () => {
  const { assertClientAccess } = await import('./client-access')

  await expect(assertClientAccess(clientId)).rejects.toBeInstanceOf(ForbiddenError)

  await startTrialIfEligible(clientId, '+79990000011')
  await expect(assertClientAccess(clientId)).resolves.toBeUndefined()

  await expect(assertClientAccess(owner.id)).resolves.toBeUndefined()

  vi.setSystemTime(new Date(NOW.getTime() + 31 * DAY))
  await expect(assertClientAccess(clientId)).rejects.toThrow('Подписка закончилась')
})

test('список подписок: область own — только свои клиенты, all — все клиенты зала', async () => {
  const { listSubscriptionsForActor } = await import('./list')

  const own = await listSubscriptionsForActor(trainer)
  expect(own.map((item) => item.userId)).toEqual([clientId])

  const all = await listSubscriptionsForActor(owner)
  expect(all.map((item) => item.userId).sort()).toEqual([clientId, otherClientId].sort())
})

test('список подписок: клиент без права — ForbiddenError', async () => {
  const { listSubscriptionsForActor } = await import('./list')
  await expect(listSubscriptionsForActor(client)).rejects.toBeInstanceOf(ForbiddenError)
})

test('история подписки: не больше 10 событий конкретного клиента, чужой клиент закрыт', async () => {
  const { listSubscriptionEvents } = await import('./list')

  await startTrialIfEligible(clientId, '+79990000011')
  await startTrialIfEligible(otherClientId, '+79990000012')
  for (let i = 0; i < 12; i += 1) await grant(owner, clientId, { months: 1 })

  const events = await listSubscriptionEvents(owner, clientId)
  expect(events).toHaveLength(10)
  expect(events.every((event) => event.userId === clientId)).toBe(true)

  await expect(listSubscriptionEvents(trainer, otherClientId)).rejects.toBeInstanceOf(
    ForbiddenError,
  )
})

test('grant замороженному: оставшиеся дни не сгорают', async () => {
  await startTrialIfEligible(clientId, '+79990000011')
  // осталось 20 дней, заморозили 10 дней назад
  vi.setSystemTime(new Date(NOW.getTime() + 10 * DAY))
  await freeze(owner, clientId)
  const frozen = await currentSub(clientId)
  vi.setSystemTime(new Date(NOW.getTime() + 20 * DAY))

  const granted = await grant(owner, clientId, { months: 1 })

  const base = new Date(frozen.endsAt.getTime() + 10 * DAY)
  const expected = new Date(base)
  expected.setUTCMonth(expected.getUTCMonth() + 1)
  expect(granted.endsAt.toISOString()).toBe(expected.toISOString())
  expect(granted.status).toBe('active')
  expect(granted.frozenAt).toBeNull()
})

test('grant до прошедшей даты — ошибка', async () => {
  await expect(
    grant(owner, clientId, { untilDate: new Date(NOW.getTime() - DAY) }),
  ).rejects.toThrow('Дата должна быть в будущем')
})

test('посторонний не узнаёт, есть ли пользователь', async () => {
  await expect(
    grant(client, '00000000-0000-0000-0000-000000000000', { months: 1 }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('два параллельных startTrialIfEligible для одного номера — одна подписка', async () => {
  const results = await Promise.all([
    startTrialIfEligible(clientId, '+79990000011'),
    startTrialIfEligible(clientId, '+79990000011'),
  ])
  expect(results.filter(Boolean)).toHaveLength(1)

  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, clientId))
  expect(rows).toHaveLength(1)
  const events = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.userId, clientId))
  expect(events.filter((event) => event.type === 'trial_started')).toHaveLength(1)
})
