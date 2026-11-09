import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { LanguageModel } from 'ai'
import { eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { setLogs, workoutSessions } from '@/modules/training'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { buildSummaryInput, summarizeSession, trimToWord } from './summary'

let userId: string
let sessionId: string
let exerciseId: string

const fakeModel = { modelId: 'fake' } as unknown as LanguageModel

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

  const [user] = await db
    .insert(users)
    .values({ phone: '+79990000011', name: 'Клиент', gymId: gym!.id, roleId: roles['Клиент']!.id })
    .returning()
  userId = user!.id

  const [exercise] = await db
    .insert(exercises)
    .values({
      gymId: gym!.id,
      name: 'Жим ногами',
      slug: `zhim-nogami-${Date.now()}`,
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
    })
    .returning()
  exerciseId = exercise!.id

  const [session] = await db
    .insert(workoutSessions)
    .values({
      userId,
      programDayId: null,
      mode: 'free',
      clientUuid: randomUUID(),
      startedAt: new Date(Date.now() - 45 * 60 * 1000),
      finishedAt: new Date(),
    })
    .returning()
  sessionId = session!.id

  await db.insert(setLogs).values({
    sessionId,
    exerciseId,
    setIndex: 1,
    weightKg: 120,
    reps: 10,
    feeling: 'hard',
    clientUuid: randomUUID(),
  })
})

test('buildSummaryInput содержит упражнение, вес, повторения и объём', () => {
  const text = buildSummaryInput(
    { startedAt: new Date(), finishedAt: new Date(), mode: 'free' },
    [{ exerciseId, name: 'Жим ногами', sets: [{ weightKg: 120, reps: 10, feeling: 'hard' }] }],
  )

  expect(text).toContain('Жим ногами')
  expect(text).toContain('120 кг × 10')
  expect(text).toContain('Объём: 1200 кг')
})

test('trimToWord обрезает до 240 символов по границе слова', () => {
  const long = `${'слово '.repeat(60)}конец`
  const trimmed = trimToWord(long)

  expect(trimmed.length).toBeLessThanOrEqual(240)
  expect(trimmed.endsWith('слово')).toBe(true)
  expect(trimToWord('короткий итог')).toBe('короткий итог')
})

test('недоступность ИИ → null, ошибка не пробрасывается', async () => {
  const generate = async () => {
    throw new Error('network')
  }

  await expect(
    summarizeSession(sessionId, {
      generate: generate as unknown as typeof import('ai').generateText,
      getModel: () => fakeModel,
      timeoutMs: 50,
    }),
  ).resolves.toBeNull()
})

test('итог сохраняется в workout_sessions.ai_summary', async () => {
  const generate = async () => ({ text: 'Хорошо пожал ногами 120 кг — держим темп.' })

  const summary = await summarizeSession(sessionId, {
    generate: generate as unknown as typeof import('ai').generateText,
    getModel: () => fakeModel,
  })

  expect(summary).toBe('Хорошо пожал ногами 120 кг — держим темп.')

  const [row] = await db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId))
  expect(row?.aiSummary).toBe(summary)
})