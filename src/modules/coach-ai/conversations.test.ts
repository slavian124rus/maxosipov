import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { users } from '@/modules/auth'
import { gyms } from '@/modules/gym'
import { aiProposals } from '@/modules/training'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import {
  archiveConversation,
  getConversationMessages,
  listConversations,
  titleFromText,
} from './conversations'
import { aiConversations, aiMessages } from './schema'

let userId: string
let otherId: string

async function chat(owner: string, title: string | null, texts: [string, string][], updatedAt: Date) {
  const [conversation] = await db
    .insert(aiConversations)
    .values({ userId: owner, title, updatedAt })
    .returning()
  for (const [index, [role, content]] of texts.entries()) {
    await db.insert(aiMessages).values({
      conversationId: conversation!.id,
      userId: owner,
      role: role as 'user' | 'assistant',
      content,
      createdAt: new Date(updatedAt.getTime() + index * 1000),
    })
  }
  return conversation!.id
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
      address: 'Красноярск',
      brand: { name: 'М', shortName: 'М', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 },
        aiMemo: '',
      },
    })
    .returning()
  const [u1, u2] = await db
    .insert(users)
    .values([
      { phone: '+79990000011', name: 'Клиент', gymId: gym!.id, roleId: roles['Клиент']!.id },
      { phone: '+79990000012', name: 'Другой', gymId: gym!.id, roleId: roles['Клиент']!.id },
    ])
    .returning()
  userId = u1!.id
  otherId = u2!.id
})

test('titleFromText: коротко, без переносов, по границе слова', () => {
  expect(titleFromText('  Собери\nмне   тренировку  ')).toBe('Собери мне тренировку')
  expect(titleFromText('')).toBe('Новый чат')
  const long = titleFromText('Почему мне в жиме лёжа советуют такой вес на следующую тренировку')
  expect(long.length).toBeLessThanOrEqual(41)
  expect(long.endsWith('…')).toBe(true)
  expect(long).not.toContain('  ')
})

test('список: новые сверху, с последней репликой; архивные и пустые не показываются', async () => {
  await chat(userId, 'Старый', [['user', 'Привет'], ['assistant', 'Здравствуй!']], new Date('2026-11-01T10:00:00Z'))
  await chat(userId, 'Свежий', [['user', 'Вопрос'], ['assistant', 'Ответ про жим']], new Date('2026-11-10T10:00:00Z'))
  const archived = await chat(userId, 'В архиве', [['user', 'x']], new Date('2026-11-11T10:00:00Z'))
  await archiveConversation(userId, archived)
  await db.insert(aiConversations).values({ userId, title: 'Пустой' })
  await chat(otherId, 'Чужой', [['user', 'секрет']], new Date('2026-11-12T10:00:00Z'))

  const list = await listConversations(userId)
  expect(list.map((item) => item.title)).toEqual(['Свежий', 'Старый'])
  expect(list[0]!.lastText).toBe('Ответ про жим')
})

test('список: поиск по заголовку без учёта регистра и ё/е', async () => {
  await chat(userId, 'Замена приседа', [['user', 'a']], new Date('2026-11-01T10:00:00Z'))
  await chat(userId, 'Болит плечо', [['user', 'b']], new Date('2026-11-02T10:00:00Z'))
  expect((await listConversations(userId, { query: 'ПРИСЕД' })).map((i) => i.title)).toEqual(['Замена приседа'])
})

test('список: точка, если в чате есть предложение, которое ждёт решения', async () => {
  const id = await chat(userId, 'С предложением', [['user', 'a'], ['assistant', 'b']], new Date())
  await db.insert(aiProposals).values({ userId, conversationId: id, diff: [], status: 'pending' })
  const other = await chat(userId, 'Без', [['user', 'a']], new Date(Date.now() - 1000))

  const list = await listConversations(userId)
  expect(list.find((i) => i.id === id)!.hasPending).toBe(true)
  expect(list.find((i) => i.id === other)!.hasPending).toBe(false)
})

test('сообщения диалога: по порядку, только свои', async () => {
  const id = await chat(userId, 'Т', [['user', 'один'], ['assistant', 'два']], new Date())
  const messages = await getConversationMessages(userId, id)
  expect(messages?.map((m) => m.content)).toEqual(['один', 'два'])
  expect(await getConversationMessages(otherId, id)).toBeNull()
})

test('архив: чужой диалог не архивируется', async () => {
  const id = await chat(userId, 'Т', [['user', 'a']], new Date())
  await expect(archiveConversation(otherId, id)).rejects.toThrow(/не найден/i)
  await archiveConversation(userId, id)
  expect(await listConversations(userId)).toHaveLength(0)
})
