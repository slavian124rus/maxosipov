import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { ZodError } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { startTrialIfEligible } from './service'
import { updateAccessSettings } from './settings'

const DAY = 24 * 60 * 60 * 1000

let admin: Actor
let client: Actor
let gymId: string
let clientId: string

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

  const [adminRow] = await db
    .insert(users)
    .values({
      phone: '+79990000002',
      name: 'Максим',
      gymId,
      roleId: roles['Главный тренер']!.id,
    })
    .returning()
  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId: adminRow!.id,
    })
    .returning()
  clientId = clientRow!.id

  admin = {
    id: adminRow!.id,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'subscriptions.pricing', scope: 'all' }],
  }
  client = {
    id: clientRow!.id,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }
})

test('тренер с subscriptions.pricing меняет длительность пробного периода', async () => {
  await updateAccessSettings(admin, { trialDays: 14, subscriptionPriceRub: 3000 })

  const [gym] = await db.select().from(gyms).where(eq(gyms.id, gymId))
  expect(gym?.settings.trialDays).toBe(14)
  expect(gym?.settings.subscriptionPriceRub).toBe(3000)

  const now = new Date()
  await startTrialIfEligible(clientId, '+79990000011')
  const { subscriptions } = await import('./schema')
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, clientId))
  expect(Math.round(((sub?.endsAt.getTime() ?? 0) - now.getTime()) / DAY)).toBe(14)
})

test('без права subscriptions.pricing — ForbiddenError', async () => {
  await expect(
    updateAccessSettings(client, { trialDays: 14, subscriptionPriceRub: null }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('trialDays: 120 — ошибка валидации', async () => {
  await expect(
    updateAccessSettings(admin, { trialDays: 120, subscriptionPriceRub: null }),
  ).rejects.toBeInstanceOf(ZodError)
})
