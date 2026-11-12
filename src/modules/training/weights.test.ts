import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { clientProfiles, users } from '@/modules/auth'
import { exercises, machines } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import type { Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { copyTemplateToClient, getProgramTree } from './programs'
import { programDays, programExercises, programs } from './schema'
import { createTemplate, replaceTemplateDays } from './templates'
import {
  applyProgramWeights,
  estimateWeightsForClient,
  fillProgramWeightsFromProfile,
  programWeightStats,
} from './weights'

let gymId: string
let trainer: Actor
let trainerId: string
let clientId: string
let templateId: string
let gakk: string
let abs: string

async function addExercise(
  name: string,
  options: { machineId?: string; primary?: string[]; stepKg?: number },
): Promise<string> {
  let machineId = options.machineId ?? null

  if (options.stepKg !== undefined) {
    const [machine] = await db
      .insert(machines)
      .values({ gymId, name: `${name} — тренажёр`, zone: 'Ноги', weightStepKg: options.stepKg })
      .returning({ id: machines.id })
    machineId = machine!.id
  }

  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      machineId,
      name,
      slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryMuscles: (options.primary ?? ['quads']) as never,
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
      defaultRepMin: 10,
      defaultRepMax: 12,
    })
    .returning({ id: exercises.id })

  return row!.id
}

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

  const [trainerRow] = await db
    .insert(users)
    .values({ phone: '+79990000002', name: 'Максим', gymId, roleId: roles['Главный тренер']!.id })
    .returning()
  trainerId = trainerRow!.id

  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId,
    })
    .returning()
  clientId = clientRow!.id

  trainer = {
    id: trainerId,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'own' }],
  }

  gakk = await addExercise('Гакк-приседания', { primary: ['quads'], stepKg: 5 })
  abs = await addExercise('Скручивания', { primary: ['abs'], stepKg: 5 })

  templateId = await createTemplate(trainer, { name: 'Похудение', audience: 'female', goal: 'fat_loss' })
  await replaceTemplateDays(trainer, templateId, [
    {
      name: 'День 1',
      exercises: [
        { exerciseId: gakk, sets: 3, repMin: 10, repMax: 12 },
        { exerciseId: abs, sets: 3, repMin: 15, repMax: 20 },
      ],
    },
  ])
})

async function addProfile(overrides: Partial<typeof clientProfiles.$inferInsert> = {}): Promise<void> {
  await db.insert(clientProfiles).values({
    userId: clientId,
    sex: 'male',
    birthYear: new Date().getFullYear() - 30,
    heightCm: 180,
    weightKg: 80,
    goal: 'fat_loss',
    experience: 'novice',
    sessionsPerWeek: 3,
    healthConsentAt: new Date(),
    ...overrides,
  })
}

test('выдача шаблона подставляет веса по анкете: свои у каждого клиента', async () => {
  await addProfile()

  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)
  const gakkItem = program.days[0]!.exercises.find((item) => item.exerciseId === gakk)
  const absItem = program.days[0]!.exercises.find((item) => item.exerciseId === abs)

  // 80 кг × 0.5 (ноги, тренажёр) × 0.6 (новичок) × 0.9 (похудение) = 21.6 → шаг 5 → 20
  expect(gakkItem?.targetWeightKg).toBe(20)
  // Пресс — собственный вес: блины не подсказываем.
  expect(absItem?.targetWeightKg).toBeNull()
})

test('вес из шаблона важнее расчётного', async () => {
  await addProfile()

  await db
    .update(programExercises)
    .set({ targetWeightKg: 60 })
    .where(eq(programExercises.exerciseId, gakk))

  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)
  const gakkItem = program.days[0]!.exercises.find((item) => item.exerciseId === gakk)

  expect(gakkItem?.targetWeightKg).toBe(60)
})

test('без анкеты программа выдаётся, но без весов', async () => {
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)

  expect(program.days[0]!.exercises.every((item) => item.targetWeightKg === null)).toBe(true)
  expect(await estimateWeightsForClient(clientId, [gakk])).toEqual({})
})

test('fillProgramWeightsFromProfile заполняет только пустые веса', async () => {
  await addProfile()
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)

  await db
    .update(programExercises)
    .set({ targetWeightKg: 55 })
    .where(eq(programExercises.exerciseId, gakk))
  await db
    .update(programExercises)
    .set({ targetWeightKg: null })
    .where(eq(programExercises.exerciseId, abs))

  const tree = (await getProgramTree(program.id))!
  const result = await fillProgramWeightsFromProfile(tree)

  expect(result).toEqual({ filled: 0, total: 2, hasProfile: true })

  const rows = await db
    .select({ exerciseId: programExercises.exerciseId, targetWeightKg: programExercises.targetWeightKg })
    .from(programExercises)
    .innerJoin(programDays, eq(programDays.id, programExercises.dayId))
    .where(eq(programDays.programId, program.id))

  expect(rows.find((row) => row.exerciseId === gakk)?.targetWeightKg).toBe(55)
  expect(rows.find((row) => row.exerciseId === abs)?.targetWeightKg).toBeNull()
})

test('applyProgramWeights перезаписывает веса, если не onlyEmpty', async () => {
  await addProfile()
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)

  const updated = await applyProgramWeights(program.id, { [gakk]: 35, [abs]: 10 })

  expect(updated).toBe(2)

  const tree = (await getProgramTree(program.id))!
  expect(tree.days[0]!.exercises.find((item) => item.exerciseId === gakk)?.targetWeightKg).toBe(35)
  expect(tree.days[0]!.exercises.find((item) => item.exerciseId === abs)?.targetWeightKg).toBe(10)
})

test('programWeightStats считает, у скольких упражнений есть вес', async () => {
  await addProfile()
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)
  const tree = (await getProgramTree(program.id))!

  expect(programWeightStats(tree)).toEqual({ total: 2, withWeight: 1 })
})

test('веса считаются и для шаблона другого зала: чужие упражнения просто пропускаются', async () => {
  await addProfile()

  const weights = await estimateWeightsForClient(clientId, [gakk, '00000000-0000-4000-8000-000000000000'])

  expect(weights).toEqual({ [gakk]: 20 })
})

test('шаблоны не получают весов: у них нет владельца', async () => {
  const tree = (await getProgramTree(templateId))!

  expect(await fillProgramWeightsFromProfile(tree)).toEqual({ filled: 0, total: 2, hasProfile: false })
})

test('веса копии не влияют на шаблон', async () => {
  await addProfile()
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)
  await applyProgramWeights(program.id, { [gakk]: 45 })

  const templateTree = (await getProgramTree(templateId))!
  expect(templateTree.days[0]!.exercises.every((item) => item.targetWeightKg === null)).toBe(true)
})

test('программа клиента не меняет чужую программу через applyProgramWeights', async () => {
  await addProfile()
  const program = await copyTemplateToClient(trainer, templateId, clientId, gymId)
  const [other] = await db
    .insert(programs)
    .values({ gymId, ownerId: null, authorId: trainerId, authorKind: 'trainer', name: 'Другой шаблон' })
    .returning({ id: programs.id })

  const updated = await applyProgramWeights(other!.id, { [gakk]: 30 })

  expect(updated).toBe(0)
  const tree = (await getProgramTree(program.id))!
  expect(tree.days[0]!.exercises.find((item) => item.exerciseId === gakk)?.targetWeightKg).toBe(20)
})
