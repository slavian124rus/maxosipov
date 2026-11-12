import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { programDays, programExercises, programs } from './schema'
import {
  archiveTemplate,
  createTemplate,
  listTemplateItems,
  replaceTemplateDays,
  templateMeta,
  templateTitle,
  updateTemplateMeta,
} from './templates'

let gymId: string
let trainer: Actor
let trainerId: string
let client: Actor
let exerciseA: string
let exerciseB: string

async function addExercise(name: string): Promise<string> {
  const [row] = await db
    .insert(exercises)
    .values({
      gymId,
      name,
      slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryMuscles: ['lats'],
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

  trainer = {
    id: trainerId,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'own' }],
  }
  client = {
    id: '00000000-0000-4000-8000-000000000099',
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }

  exerciseA = await addExercise('Тяга верхнего блока')
  exerciseB = await addExercise('Гакк-приседания')
})

test('templateTitle: номер и аудитория в названии', () => {
  expect(templateTitle({ name: 'Похудение', audience: 'female', number: 1 })).toBe(
    'Похудение для женщин №1',
  )
  expect(templateTitle({ name: 'Масса', audience: 'male', number: 2 })).toBe('Масса для мужчин №2')
  expect(templateTitle({ name: 'Старт', audience: 'any', number: null })).toBe('Старт для всех')
  expect(templateTitle({ name: 'Без меты', audience: null, number: null })).toBe('Без меты')
})

test('templateMeta: цель · дни · упражнения со склонениями', () => {
  expect(templateMeta({ goal: 'fat_loss', days: 3, exercises: 18 })).toBe(
    'Похудение · 3 дня · 18 упражнений',
  )
  expect(templateMeta({ goal: null, days: 1, exercises: 5 })).toBe('1 день · 5 упражнений')
  expect(templateMeta({ goal: 'mass', days: 5, exercises: 30 })).toBe(
    'Масса · 5 дней · 30 упражнений',
  )
})

test('createTemplate: номер выдаётся по порядку, аудитория и цель сохраняются', async () => {
  const first = await createTemplate(trainer, {
    name: 'Похудение',
    audience: 'female',
    goal: 'fat_loss',
  })
  const second = await createTemplate(trainer, { name: 'Масса', audience: 'male', goal: 'mass' })

  const rows = await db.select().from(programs).orderBy(programs.templateNumber)
  expect(rows.map((row) => row.templateNumber)).toEqual([1, 2])
  expect(rows[0]).toMatchObject({ audience: 'female', goal: 'fat_loss', ownerId: null })
  expect(rows[0]?.id).toBe(first)
  expect(rows[1]?.id).toBe(second)
})

test('createTemplate: пустые дни создаются сразу, если указано количество', async () => {
  const id = await createTemplate(trainer, { name: 'Старт', days: 3 })

  const days = await db.select().from(programDays).where(eq(programDays.programId, id))
  expect(days.map((day) => day.name)).toEqual(['День 1', 'День 2', 'День 3'])
})

test('createTemplate: короткое имя и отсутствие прав — отказ', async () => {
  await expect(createTemplate(trainer, { name: ' Я ' })).rejects.toThrow('от 2 символов')
  await expect(createTemplate(client, { name: 'Похудение' })).rejects.toBeInstanceOf(ForbiddenError)
})


test('listTemplateItems: заголовок, подпись и счётчики', async () => {
  const id = await createTemplate(trainer, {
    name: 'Похудение',
    audience: 'female',
    goal: 'fat_loss',
  })

  await replaceTemplateDays(trainer, id, [
    {
      name: 'День 1 — ноги',
      exercises: [{ exerciseId: exerciseB, sets: 3, repMin: 10, repMax: 12 }],
    },
    {
      name: 'День 2 — спина',
      exercises: [
        { exerciseId: exerciseA, sets: 4, repMin: 8, repMax: 10 },
        { exerciseId: exerciseB, sets: 3, repMin: 12, repMax: 15 },
      ],
    },
  ])

  const [item] = await listTemplateItems()
  expect(item).toMatchObject({
    title: 'Похудение для женщин №1',
    subtitle: 'Похудение · 2 дня · 3 упражнений',
    days: 2,
    exercises: 3,
  })
})

test('archiveTemplate: шаблон пропадает из списка, но остаётся в базе', async () => {
  const id = await createTemplate(trainer, { name: 'Старый' })

  await archiveTemplate(trainer, id)

  expect(await listTemplateItems()).toEqual([])
  const [row] = await db.select().from(programs).where(eq(programs.id, id))
  expect(row?.status).toBe('archived')
})

test('archiveTemplate: программу клиента как шаблон не удаляем', async () => {
  const [clientProgram] = await db
    .insert(programs)
    .values({
      gymId,
      ownerId: client.id,
      authorId: trainerId,
      authorKind: 'trainer',
      name: 'Программа клиента',
    })
    .returning({ id: programs.id })

  await expect(archiveTemplate(trainer, clientProgram!.id)).rejects.toThrow(
    'Это программа клиента, а не шаблон',
  )
})

test('updateTemplateMeta: имя, аудитория и цель правятся', async () => {
  const id = await createTemplate(trainer, { name: 'Похудение' })

  await updateTemplateMeta(trainer, id, {
    name: 'Жиросжигание',
    audience: 'female',
    goal: 'health',
  })

  const [row] = await db.select().from(programs).where(eq(programs.id, id))
  expect(row).toMatchObject({ name: 'Жиросжигание', audience: 'female', goal: 'health' })
})


test('replaceTemplateDays: дни заменяются целиком, схема сохраняется', async () => {
  const id = await createTemplate(trainer, { name: 'Старт', days: 2 })

  await replaceTemplateDays(trainer, id, [
    {
      name: 'День 1 — ноги',
      exercises: [{ exerciseId: exerciseB, sets: 5, repMin: 6, repMax: 8, restSec: 150 }],
    },
  ])

  const days = await db.select().from(programDays).where(eq(programDays.programId, id))
  expect(days).toHaveLength(1)

  const [item] = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.dayId, days[0]!.id))
  expect(item).toMatchObject({ sets: 5, repMin: 6, repMax: 8, restSec: 150 })
})

test('replaceTemplateDays: пустой день и чужое упражнение — отказ', async () => {
  const id = await createTemplate(trainer, { name: 'Старт' })

  await expect(
    replaceTemplateDays(trainer, id, [{ name: 'Пусто', exercises: [] }]),
  ).rejects.toThrow('нет упражнений')

  await expect(
    replaceTemplateDays(trainer, id, [
      {
        name: 'День',
        exercises: [
          { exerciseId: '00000000-0000-4000-8000-000000000000', sets: 3, repMin: 10, repMax: 12 },
        ],
      },
    ]),
  ).rejects.toThrow('не из каталога')
})

test('replaceTemplateDays: программу клиента и роль без прав не трогаем', async () => {
  const [clientProgram] = await db
    .insert(programs)
    .values({ gymId, ownerId: client.id, authorId: trainerId, authorKind: 'trainer', name: 'Клиент' })
    .returning({ id: programs.id })

  await expect(
    replaceTemplateDays(trainer, clientProgram!.id, [
      { name: 'День', exercises: [{ exerciseId: exerciseA, sets: 3, repMin: 10, repMax: 12 }] },
    ]),
  ).rejects.toThrow('только у шаблона')

  const templateId = await createTemplate(trainer, { name: 'Старт' })
  await expect(
    replaceTemplateDays(client, templateId, [
      { name: 'День', exercises: [{ exerciseId: exerciseA, sets: 3, repMin: 10, repMax: 12 }] },
    ]),
  ).rejects.toBeInstanceOf(ForbiddenError)
})
