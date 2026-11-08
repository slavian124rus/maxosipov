import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { gyms } from '@/modules/gym'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { cleanupAuth } from './cleanup'
import { otpCodes, pendingLinks, sessions } from './schema'

const NOW = new Date('2026-11-08T03:00:00Z')
const HOUR = 60 * 60 * 1000

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
})

test('удаляет просроченные сессии, старые коды и истёкшие привязки, свежее не трогает', async () => {
  const roles = await seedDefaultRoles()
  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск',
      brand: { name: 'М', shortName: 'М', colors: { accent: '#E5322D' }, logoUrl: null },
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
  const [user] = await db
    .insert(users)
    .values({ phone: '+79991112233', name: 'К', gymId: gym!.id, roleId: roles['Клиент']!.id })
    .returning()

  await db.insert(sessions).values([
    {
      userId: user!.id,
      tokenHash: 'old',
      expiresAt: new Date(NOW.getTime() - HOUR),
      userAgent: null,
    },
    {
      userId: user!.id,
      tokenHash: 'fresh',
      expiresAt: new Date(NOW.getTime() + HOUR),
      userAgent: null,
    },
  ])

  const otp = (createdAt: Date) => ({
    phone: '+79991112233',
    codeHash: 'x'.repeat(64),
    ip: '1.1.1.1',
    expiresAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
    createdAt,
    updatedAt: createdAt,
  })
  await db
    .insert(otpCodes)
    .values([otp(new Date(NOW.getTime() - 50 * HOUR)), otp(new Date(NOW.getTime() - HOUR))])

  await db.insert(pendingLinks).values([
    { provider: 'vk', providerUserId: '1', name: null, expiresAt: new Date(NOW.getTime() - HOUR) },
    { provider: 'vk', providerUserId: '2', name: null, expiresAt: new Date(NOW.getTime() + HOUR) },
  ])

  expect(await cleanupAuth(NOW)).toEqual({ sessions: 1, otpCodes: 1, pendingLinks: 1 })
  expect(await db.select().from(sessions)).toHaveLength(1)
  expect(await db.select().from(otpCodes)).toHaveLength(1)
  expect(await db.select().from(pendingLinks)).toHaveLength(1)
})
