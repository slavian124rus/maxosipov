import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { gyms } from '@/modules/gym'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { aiUsageDaily } from './schema'
import { costRubFor, getTodayUsage, isOverLimit, recordUsage } from './usage'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TZ = 'Asia/Krasnoyarsk'

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()

  await db.insert(gyms).values({
    name: 'Колизей',
    address: 'Красноярск, ул. Говорова',
    timezone: TZ,
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
})

test('сообщение в 23:59 и 00:01 по Красноярску — разные сутки', async () => {
  const late = new Date('2026-11-08T16:59:00Z') // 23:59 в Красноярске
  const early = new Date('2026-11-08T17:01:00Z') // 00:01 следующего дня

  await recordUsage(
    USER_ID,
    { model: 'model-main', tokensIn: 100, tokensOut: 50, countsTowardLimit: true },
    { now: late, timeZone: TZ, prices: {} },
  )

  await expect(getTodayUsage(USER_ID, late, TZ)).resolves.toEqual({ messages: 1 })
  await expect(getTodayUsage(USER_ID, early, TZ)).resolves.toEqual({ messages: 0 })
})

test('recordUsage суммирует сообщения, токены и стоимость', async () => {
  const now = new Date('2026-11-08T10:00:00Z')
  const prices = { 'model-main': { inPer1k: 10, outPer1k: 20 } }

  await recordUsage(
    USER_ID,
    { model: 'model-main', tokensIn: 1000, tokensOut: 500, countsTowardLimit: true },
    { now, timeZone: TZ, prices },
  )
  await recordUsage(
    USER_ID,
    { model: 'model-main', tokensIn: 1000, tokensOut: 500, countsTowardLimit: true },
    { now, timeZone: TZ, prices },
  )

  await expect(getTodayUsage(USER_ID, now, TZ)).resolves.toEqual({ messages: 2 })

  const [row] = await db
    .select()
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.userId, USER_ID), eq(aiUsageDaily.date, '2026-11-08')))

  expect(row?.tokens).toBe(3000)
  expect(row?.costRub).toBe(40) // два вызова по 10 + 10 = 40
})

test('итог тренировки не входит в лимит сообщений, но токены учитываются', async () => {
  const now = new Date('2026-11-08T10:00:00Z')

  await recordUsage(
    USER_ID,
    { model: 'model-main', tokensIn: 400, tokensOut: 100, countsTowardLimit: false },
    { now, timeZone: TZ, prices: {} },
  )

  await expect(getTodayUsage(USER_ID, now, TZ)).resolves.toEqual({ messages: 0 })
  await expect(isOverLimit(USER_ID, 30, now)).resolves.toBe(false)
})

test('isOverLimit: 30 сообщений — лимит исчерпан', async () => {
  const now = new Date('2026-11-08T10:00:00Z')

  for (let index = 0; index < 30; index += 1) {
    await recordUsage(
      USER_ID,
      { model: 'model-main', tokensIn: 1, tokensOut: 1, countsTowardLimit: true },
      { now, timeZone: TZ, prices: {} },
    )
  }

  await expect(isOverLimit(USER_ID, 30, now)).resolves.toBe(true)
})

test('costRubFor без цены модели — ноль', () => {
  expect(costRubFor('unknown', 1000, 1000, {})).toBe(0)
  expect(costRubFor('m', 1000, 1000, { m: { inPer1k: 1, outPer1k: 2 } })).toBe(3)
})