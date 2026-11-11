import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { users } from './schema'
import { saveOnboarding, saveProfileDetails, updateUserName } from './profile'
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
let clientRoleId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()
  clientRoleId = roles['Клиент']!.id
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

test('анкета клиента с почтой: свободный телефон сохраняется как контакт', async () => {
  const [emailUser] = await db
    .insert(users)
    .values({ email: 'a@example.com', name: 'А', gymId: GYM_ID, roleId: clientRoleId })
    .returning()

  await saveOnboarding(emailUser!.id, validInput, { phone: '+79990000055' })

  const [row] = await db.select().from(users).where(eq(users.id, emailUser!.id))
  expect(row?.phone).toBe('+79990000055')
})

test('занятый телефон не блокирует анкету и не перезаписывается', async () => {
  const [emailUser] = await db
    .insert(users)
    .values({ email: 'b@example.com', name: 'Б', gymId: GYM_ID, roleId: clientRoleId })
    .returning()

  await saveOnboarding(emailUser!.id, validInput, { phone: '+79990000011' })

  const [row] = await db.select().from(users).where(eq(users.id, emailUser!.id))
  expect(row?.phone).toBeNull()
  expect(row?.onboardingCompletedAt).not.toBeNull()
})

test('клиент меняет имя в профиле: сохраняется и обрезается', async () => {
  const saved = await updateUserName(userId, '  Иван Петров  ')

  expect(saved).toBe('Иван Петров')
  const [row] = await db.select().from(users).where(eq(users.id, userId))
  expect(row?.name).toBe('Иван Петров')
})

test('слишком короткое имя не сохраняется', async () => {
  await expect(updateUserName(userId, ' Я ')).rejects.toThrow('Имя слишком короткое')

  const [row] = await db.select().from(users).where(eq(users.id, userId))
  expect(row?.name).toBe('Иван')
})

test('saveProfileDetails: имя и анкета сохраняются, согласие на здоровье не сбрасывается', async () => {
  await saveOnboarding(userId, validInput)
  await saveProfileDetails(userId, {
    name: 'Иван П.',
    sex: 'male',
    birthYear: 1990,
    heightCm: 178,
    weightKg: 80,
    goal: 'fat_loss',
    experience: 'intermediate',
    sessionsPerWeek: 4,
    limitations: 'колено',
    healthConsent: true,
  })

  const [row] = await db.select().from(users).where(eq(users.id, userId))
  expect(row?.name).toBe('Иван П.')
  // Онбординг и согласие на ПДн уже даны — повторно не спрашиваем и не затираем.
  expect(row?.onboardingCompletedAt).toBeInstanceOf(Date)
  expect(row?.pdConsentAt).toBeInstanceOf(Date)

  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(profile?.goal).toBe('fat_loss')
  expect(profile?.sessionsPerWeek).toBe(4)
  expect(profile?.limitations).toBe('колено')
  expect(profile?.healthConsentAt).toBeInstanceOf(Date)
})

test('saveProfileDetails: без согласия на здоровье ограничения не сохраняются', async () => {
  await saveOnboarding(userId, { ...validInput, healthConsent: false })

  await saveProfileDetails(userId, {
    ...validInput,
    name: 'Иван',
    limitations: 'колено',
    healthConsent: false,
  })

  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(profile?.limitations).toBeNull()
})

test('согласие на здоровье можно дать в профиле, а отзыв стирает ограничения', async () => {
  await saveOnboarding(userId, validInput)

  await saveProfileDetails(userId, {
    ...validInput,
    name: 'Иван',
    limitations: 'колено',
    healthConsent: true,
  })
  const [granted] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(granted?.healthConsentAt).toBeInstanceOf(Date)
  expect(granted?.limitations).toBe('колено')

  await saveProfileDetails(userId, {
    ...validInput,
    name: 'Иван',
    limitations: 'колено',
    healthConsent: false,
  })
  const [withdrawn] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
  expect(withdrawn?.healthConsentAt).toBeNull()
  expect(withdrawn?.limitations).toBeNull()
})

test('saveProfileDetails: неверный год рождения — ошибка валидации', async () => {
  await expect(
    saveProfileDetails(userId, { ...validInput, name: 'Иван', birthYear: 1900 }),
  ).rejects.toThrow()
})