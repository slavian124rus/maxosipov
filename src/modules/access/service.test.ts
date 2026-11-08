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
