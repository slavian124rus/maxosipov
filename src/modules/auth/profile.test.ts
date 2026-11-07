import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { users } from './schema'
import { saveOnboarding } from './profile'
import { clientProfiles } from './schema'

const GYM_ID = '00000000-0000-4000-8000-000000000001'

const validInput = {
  sex: 'male' as const,
  birthYear: 1995,
  heightCm: 180,
  weightKg: 82.5,
  goal: 'strength' as const,
  experience: 'novice' as const,
  sessionsPerWeek: 3,
  limitations: 'побаливает поясница',
  healthConsent: true,
  pdConsent: true as const,
}

let userId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()
  const [row] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Иван',
      gymId: GYM_ID,
      roleId: roles['Клиент']!.id,
    })
    .returning()
  userId = row!.id
})

test('без согласия на ПДн — ошибка валидации', async () => {
  await expect(
    saveOnboarding(userId, { ...validInput, pdConsent: undefined as unknown as true }),
  ).rejects.toThrow()
})

test('корректный ввод сохраняет профиль и ставит onboarding_completed_at', async () => {
  await saveOnboarding(userId, validInput)

  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(profile?.goal).toBe('strength')
  expect(profile?.weightKg).toBeCloseTo(82.5)
  expect(profile?.limitations).toBe('побаливает поясница')
  expect(profile?.healthConsentAt).toBeInstanceOf(Date)

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  expect(user?.onboardingCompletedAt).toBeInstanceOf(Date)
  expect(user?.pdConsentAt).toBeInstanceOf(Date)
})

test('без согласия на здоровье ограничения не сохраняются', async () => {
  await saveOnboarding(userId, { ...validInput, healthConsent: false })

  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(profile?.limitations).toBeNull()
  expect(profile?.healthConsentAt).toBeNull()
})

test('повторное сохранение обновляет профиль, а не падает', async () => {
  await saveOnboarding(userId, validInput)
  await saveOnboarding(userId, { ...validInput, goal: 'fat_loss' })

  const rows = await db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.goal).toBe('fat_loss')
})
