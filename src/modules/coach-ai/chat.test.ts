import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import type { LanguageModel } from 'ai'
import { eq } from 'drizzle-orm'
import { subscriptions, addDays } from '@/modules/access'
import { clientProfiles, users, type User } from '@/modules/auth'
import { gyms } from '@/modules/gym'
import { notifications } from '@/modules/notifications'
import type { Actor } from '@/modules/rbac'
import { AiUnavailableError } from './provider'
import { aiMessages, aiUsageDaily } from './schema'
import { handleChatMessage, LIMIT_REPLY, UNAVAILABLE_REPLY } from './chat'
import { PAIN_REPLY } from './flags'
import { recordUsage, reserveMessage } from './usage'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'

let trainerId: string
let user: User
let actor: Actor
let current: { user: User; actor: Actor }

function mockModel(answer: string): LanguageModel {
  return new MockLanguageModelV3({
    modelId: 'mock-model',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: answer },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 20, text: 20, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  })
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
      timezone: 'Asia/Krasnoyarsk',
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

  const [trainer] = await db
    .insert(users)
    .values({
      phone: '+79990000002',
      name: 'Максим',
      gymId: gym!.id,
      roleId: roles['Главный тренер']!.id,
    })
    .returning()
  trainerId = trainer!.id

  const [row] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId: gym!.id,
      roleId: roles['Клиент']!.id,
      trainerId,
    })
    .returning()
  user = row!

  await db.insert(clientProfiles).values({
    userId: user.id,
    sex: 'male',
    birthYear: 1995,
    heightCm: 180,
    weightKg: 80,
    goal: 'mass',
    experience: 'novice',
    sessionsPerWeek: 3,
  })

  const now = new Date()
  await db.insert(subscriptions).values({
    userId: user.id,
    status: 'trial',
    startsAt: now,
    endsAt: addDays(now, 30),
  })

  actor = { id: user.id, roleId: user.roleId, gymId: user.gymId, isOwner: false, permissions: [] }
  current = { user, actor }
})

test('флаг боли: модель не вызвана, ответ PAIN_REPLY, уведомление тренеру', async () => {
  const getModel = vi.fn()

  const response = await handleChatMessage(current, null, 'болит колено, чем заменить присед?', {
    getModel,
  })

  await expect(response.text()).resolves.toBe(PAIN_REPLY)
  expect(getModel).not.toHaveBeenCalled()

  const notes = await db.select().from(notifications).where(eq(notifications.userId, trainerId))
  expect(notes).toHaveLength(1)
  expect(notes[0]?.kind).toBe('client_pain')

  const messages = await db.select().from(aiMessages)
  expect(messages.filter((message) => message.flagged === 'pain')).toHaveLength(1)
})

test('лимит: 31-е сообщение не уходит модели', async () => {
  const now = new Date()

  for (let index = 0; index < 30; index += 1) {
    await recordUsage(
      user.id,
      { model: 'mock-model', tokensIn: 1, tokensOut: 1, countsTowardLimit: true },
      { now, timeZone: 'Asia/Krasnoyarsk', prices: {} },
    )
  }

  const getModel = vi.fn()
  const response = await handleChatMessage(current, null, 'Какой вес на тягу?', { getModel, now })

  await expect(response.text()).resolves.toBe(LIMIT_REPLY)
  expect(getModel).not.toHaveBeenCalled()

  const [usage] = await db.select().from(aiUsageDaily).where(eq(aiUsageDaily.userId, user.id))
  expect(usage?.messages).toBe(30)
})

test('провайдер недоступен — понятный текст, ошибка не пробрасывается', async () => {
  const response = await handleChatMessage(current, null, 'Какой вес на тягу?', {
    getModel: () => {
      throw new AiUnavailableError()
    },
    timeoutMs: 50,
  })

  await expect(response.text()).resolves.toBe(UNAVAILABLE_REPLY)
})

test('обычный вопрос: ответ стримится, сообщения и расход сохранены', async () => {
  const model = mockModel('Ставь 40 кг, работай чисто.')

  const response = await handleChatMessage(current, null, 'Какой вес на тягу верхнего блока?', {
    getModel: () => model,
    modelName: 'mock-model',
  })

  await expect(response.text()).resolves.toBe('Ставь 40 кг, работай чисто.')

  const messages = await db.select().from(aiMessages).orderBy(aiMessages.createdAt)
  expect(messages.map((message) => message.role)).toEqual(['user', 'assistant'])
  expect(messages[1]?.content).toBe('Ставь 40 кг, работай чисто.')
  expect(messages[1]?.model).toBe('mock-model')

  const [usage] = await db.select().from(aiUsageDaily).where(eq(aiUsageDaily.userId, user.id))
  expect(usage?.messages).toBe(1)
  expect(usage?.tokens).toBe(120)
})

test('боль при исчерпанном лимите всё равно доходит до тренера', async () => {
  const now = new Date()

  for (let index = 0; index < 30; index += 1) {
    await recordUsage(
      user.id,
      { model: 'mock-model', tokensIn: 1, tokensOut: 1, countsTowardLimit: true },
      { now, timeZone: 'Asia/Krasnoyarsk', prices: {} },
    )
  }

  const getModel = vi.fn()
  const response = await handleChatMessage(current, null, 'болит колено', { getModel, now })

  await expect(response.text()).resolves.toBe(PAIN_REPLY)
  expect(getModel).not.toHaveBeenCalled()
  expect(await db.select().from(notifications)).toHaveLength(1)
})

test('лимит занимается атомарно: 40 параллельных запросов → ровно 30 слотов', async () => {
  const now = new Date()
  const results = await Promise.all(
    Array.from({ length: 40 }, () => reserveMessage(user.id, 30, now, 'Asia/Krasnoyarsk')),
  )

  expect(results.filter(Boolean)).toHaveLength(30)
})

test('провайдер недоступен — слот лимита возвращается', async () => {
  await handleChatMessage(current, null, 'Какой вес на тягу?', {
    getModel: () => {
      throw new AiUnavailableError()
    },
    timeoutMs: 50,
  })

  const [usage] = await db.select().from(aiUsageDaily).where(eq(aiUsageDaily.userId, user.id))
  expect(usage?.messages ?? 0).toBe(0)
})
