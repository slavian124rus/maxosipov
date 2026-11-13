import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import { users } from '@/modules/auth'
import { aiConversations, aiMessages, aiUsageDaily } from '@/modules/coach-ai'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import {
  getAiSpend,
  updateAiSettings,
  updateBrand,
  updateContacts,
  updateProgressionRules,
} from './settings'
import { gyms } from './schema'

let gymId: string
let owner: Actor
let client: Actor

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
        aiPrices: { 'model-main': { inPer1k: 10, outPer1k: 20 } },
      },
    })
    .returning()
  gymId = gym!.id

  const [ownerRow] = await db
    .insert(users)
    .values({ phone: '+79990000001', name: 'Владелец', gymId, roleId: roles['Владелец']!.id })
    .returning()

  const [clientRow] = await db
    .insert(users)
    .values({ phone: '+79990000011', name: 'Клиент', gymId, roleId: roles['Клиент']!.id })
    .returning()

  owner = {
    id: ownerRow!.id,
    roleId: roles['Владелец']!.id,
    gymId,
    isOwner: true,
    permissions: [],
  }
  client = {
    id: clientRow!.id,
    roleId: roles['Клиент']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }
})

test('памятка и лимит сохраняются, лимит 201 — ошибка валидации', async () => {
  const settings = await updateAiSettings(owner, {
    aiMemo: 'Я за технику',
    aiDailyLimit: 40,
    aiPrices: { 'model-main': { inPer1k: 5, outPer1k: 5 } },
  })

  expect(settings.aiMemo).toBe('Я за технику')
  expect(settings.aiDailyLimit).toBe(40)

  await expect(
    updateAiSettings(owner, { aiMemo: '', aiDailyLimit: 201, aiPrices: {} }),
  ).rejects.toThrow()
})

test('модели по задачам: сохраняются без пробелов, пустое значение убирает переопределение', async () => {
  const settings = await updateAiSettings(owner, {
    aiMemo: '',
    aiDailyLimit: 30,
    aiPrices: {},
    aiModels: { chat: '  my-chat-model ', templates: '', quick: 'fast-one' },
  })

  expect(settings.aiModels).toEqual({ chat: 'my-chat-model', quick: 'fast-one' })

  const cleared = await updateAiSettings(owner, { aiMemo: '', aiDailyLimit: 30, aiPrices: {}, aiModels: {} })
  expect(cleared.aiModels).toEqual({})
})

test('id модели длиннее 120 символов — ошибка валидации', async () => {
  await expect(
    updateAiSettings(owner, {
      aiMemo: '',
      aiDailyLimit: 30,
      aiPrices: {},
      aiModels: { chat: 'x'.repeat(121) },
    }),
  ).rejects.toThrow()
})

test('без права settings.ai изменить настройки нельзя', async () => {
  await expect(
    updateAiSettings(client, { aiMemo: '', aiDailyLimit: 10, aiPrices: {} }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('правила прогрессии: dropPercent 40 — ошибка', async () => {
  await expect(
    updateProgressionRules(owner, {
      sessionsToIncrease: 2,
      fastTrackOnEasy: true,
      failSessionsToDrop: 2,
      dropPercent: 40,
    }),
  ).rejects.toThrow()
})

test('бренд: цвет не в формате #RRGGBB — ошибка', async () => {
  await expect(
    updateBrand(owner, { name: 'Максим Осипов', shortName: 'МаксИИм', accent: 'red' }),
  ).rejects.toThrow()
})

test('контакты сохраняются в настройках зала', async () => {
  const settings = await updateContacts(owner, { phone: '+7 999 000-00-00' })
  expect(settings.contacts?.phone).toBe('+7 999 000-00-00')
})

test('getAiSpend считает токены по моделям и общую стоимость месяца', async () => {
  const [conversation] = await db
    .insert(aiConversations)
    .values({ userId: client.id })
    .returning({ id: aiConversations.id })

  const now = new Date()

  await db.insert(aiMessages).values({
    conversationId: conversation!.id,
    userId: client.id,
    role: 'assistant',
    content: 'ответ',
    model: 'model-main',
    tokensIn: 1000,
    tokensOut: 1000,
  })

  await db.insert(aiUsageDaily).values({
    userId: client.id,
    date: `${now.toISOString().slice(0, 7)}-01`,
    messages: 1,
    tokens: 2000,
    costRub: 30,
  })

  const spend = await getAiSpend(owner, now.toISOString().slice(0, 7))

  expect(spend.byModel[0]).toMatchObject({ model: 'model-main', tokensIn: 1000, tokensOut: 1000, costRub: 30 })
  expect(spend.totalRub).toBe(30)
  void randomUUID
})