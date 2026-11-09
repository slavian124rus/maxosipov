import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { clientProfiles, users } from '@/modules/auth'
import { exercises, machines } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { programDays, programExercises, programs } from '@/modules/training'
import { db } from '@/shared/db'
import { resetDb, prepareTestDb, seedDefaultRoles, closeDb } from '../../../tests/db'
import { buildContextBlock, loadContextData } from './context'

let clientId: string
let exerciseId: string
let draftExerciseId: string

async function addExercise(name: string, status: 'published' | 'draft'): Promise<string> {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      name,
      slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status,
      defaultRepMin: 10,
      defaultRepMax: 12,
    })
    .returning({ id: exercises.id })
  return row!.id
}

let gymId: string

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
      timezone: 'Asia/Krasnoyarsk',
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

  const [trainer] = await db
    .insert(users)
    .values({ phone: '+79990000002', name: 'Максим Осипов', gymId, roleId: roles['Главный тренер']!.id })
    .returning()

  const [client] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Иван Петров',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId: trainer!.id,
    })
    .returning()
  clientId = client!.id

  await db.insert(clientProfiles).values({
    userId: clientId,
    sex: 'male',
    birthYear: 1995,
    heightCm: 180,
    weightKg: 80,
    goal: 'mass',
    experience: 'novice',
    sessionsPerWeek: 3,
  })

  const [machine] = await db
    .insert(machines)
    .values({ gymId, name: 'Жим ногами', weightStepKg: 5 })
    .returning()

  exerciseId = await addExercise('Жим ногами', 'published')
  draftExerciseId = await addExercise('Секретное упражнение', 'draft')

  await db.update(exercises).set({ machineId: machine!.id }).where(eq(exercises.id, exerciseId))

  const [program] = await db
    .insert(programs)
    .values({
      gymId,
      ownerId: clientId,
      authorId: trainer!.id,
      authorKind: 'trainer',
      name: 'Старт: 3 дня',
      status: 'active',
    })
    .returning()

  const [day] = await db
    .insert(programDays)
    .values({ programId: program!.id, order: 1, name: 'День A — ноги' })
    .returning()

  await db.insert(programExercises).values({
    dayId: day!.id,
    order: 1,
    exerciseId,
    sets: 3,
    repMin: 10,
    repMax: 12,
    restSec: 90,
  })
})

test('контекст без телефона, имени и служебных таблиц', async () => {
  const data = await loadContextData(clientId)
  const text = buildContextBlock(data)

  expect(text).not.toContain('+7999')
  expect(text).not.toContain('Иван Петров')
  expect(text).not.toContain('auth_accounts')
  expect(text).not.toContain('Ограничения')
})

test('каталог содержит только опубликованные упражнения', async () => {
  const data = await loadContextData(clientId)
  const text = buildContextBlock(data)

  expect(text).toContain('Жим ногами')
  expect(text).not.toContain('Секретное упражнение')
  expect(data.catalog.map((item) => item.id)).toContain(exerciseId)
  expect(data.catalog.map((item) => item.id)).not.toContain(draftExerciseId)
})

test('при согласии на здоровье появляется раздел «Ограничения»', async () => {
  await db
    .update(clientProfiles)
    .set({ limitations: 'колено — без глубоких приседов', healthConsentAt: new Date() })
    .where(eq(clientProfiles.userId, clientId))

  const data = await loadContextData(clientId)
  const text = buildContextBlock(data)

  expect(data.healthConsent).toBe(true)
  expect(text).toContain('Ограничения')
  expect(text).toContain('колено — без глубоких приседов')
})

test('без согласия ограничения не попадают в контекст, даже если сохранены', async () => {
  await db
    .update(clientProfiles)
    .set({ limitations: 'колено', healthConsentAt: null })
    .where(eq(clientProfiles.userId, clientId))

  const data = await loadContextData(clientId)
  const text = buildContextBlock(data)

  expect(text).not.toContain('колено')
  expect(text).not.toContain('Ограничения')
})