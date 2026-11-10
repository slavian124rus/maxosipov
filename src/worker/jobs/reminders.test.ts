import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { subscriptions } from '@/modules/access'
import { aiMessages } from '@/modules/coach-ai'
import { gyms } from '@/modules/gym'
import { notifications } from '@/modules/notifications'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import {
  addPainFlag,
  setupTrainerWorld,
  type TrainerWorld,
} from '../../modules/trainer/test-setup'
import { sendClientReminders, sendTrainerDaily } from './reminders'

// Push в этих тестах не нужен: проверяем, какие уведомления создаются.
delete process.env.VAPID_PUBLIC_KEY
delete process.env.VAPID_PRIVATE_KEY

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** 10:00 по Красноярску. */
const NOW = new Date('2026-11-10T03:00:00Z')

let world: TrainerWorld

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  world = await setupTrainerWorld()
})

async function setSubscription(
  userId: string,
  status: 'trial' | 'active' | 'expired' | 'frozen' | 'disabled',
  endsAt: Date,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status, endsAt, updatedAt: new Date() })
    .where(eq(subscriptions.userId, userId))
}

async function kindsFor(userId: string): Promise<string[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId))
  return rows.map((row) => row.kind).sort()
}

test('за 3 дня — «заканчивается», после конца (подписка уже expired) — «закончилась», повтор ничего не дублирует', async () => {
  await setSubscription(world.clientId, 'trial', new Date(NOW.getTime() + 2.5 * DAY))
  // Часовая задача subscriptions.expire уже перевела подписку в expired — напоминание всё равно нужно.
  await setSubscription(world.otherClientId, 'expired', new Date(NOW.getTime() - 10 * HOUR))

  expect(await sendClientReminders(NOW)).toEqual({ ending: 1, ended: 1 })
  expect(await kindsFor(world.clientId)).toEqual(['sub_ends_3d'])
  expect(await kindsFor(world.otherClientId)).toEqual(['sub_ended'])

  // Задача запустилась повторно — те же ключи, новых строк нет (Review Focus 4).
  await sendClientReminders(NOW)
  await sendClientReminders(new Date(NOW.getTime() + 2 * HOUR))
  expect(await kindsFor(world.clientId)).toEqual(['sub_ends_3d'])
  expect(await kindsFor(world.otherClientId)).toEqual(['sub_ended'])
})

test('осталось 1–2 дня и давно закончившаяся подписка напоминаний не получают', async () => {
  await setSubscription(world.clientId, 'active', new Date(NOW.getTime() + 1.5 * DAY))
  await setSubscription(world.otherClientId, 'expired', new Date(NOW.getTime() - 10 * DAY))

  expect(await sendClientReminders(NOW)).toEqual({ ending: 0, ended: 0 })
  expect(await db.select().from(notifications)).toHaveLength(0)
})

test('замороженная и отключённая подписки напоминаний не получают', async () => {
  await setSubscription(world.clientId, 'frozen', new Date(NOW.getTime() + 2.5 * DAY))
  await setSubscription(world.otherClientId, 'disabled', new Date(NOW.getTime() - 5 * HOUR))

  expect(await sendClientReminders(NOW)).toEqual({ ending: 0, ended: 0 })
  expect(await db.select().from(notifications)).toHaveLength(0)
})

test('сводка тренеру: свои истекающие клиенты и все неразобранные жалобы, как в ленте', async () => {
  await db
    .update(gyms)
    .set({
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
        headTrainerId: world.trainerId,
      },
    })
    .where(eq(gyms.id, world.gymId))

  await setSubscription(world.clientId, 'trial', new Date(NOW.getTime() + 3 * DAY))
  // Клиент другого тренера в сводку не попадает.
  await setSubscription(world.otherClientId, 'trial', new Date(NOW.getTime() + 2 * DAY))

  // Старая (20 дней) неразобранная жалоба в ленте есть — значит, и в сводке.
  await addPainFlag(world.clientId, 'болит колено', new Date(NOW.getTime() - 20 * DAY))
  const resolvedId = await addPainFlag(world.clientId, 'тянет поясницу', new Date(NOW.getTime() - HOUR))
  await db
    .update(aiMessages)
    .set({ resolvedAt: NOW, resolvedBy: world.trainerId })
    .where(eq(aiMessages.id, resolvedId))
  await addPainFlag(world.otherClientId, 'болит плечо', new Date(NOW.getTime() - HOUR))

  expect(await sendTrainerDaily(NOW)).toEqual({ expiring: 1, pain: 1 })

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, world.trainerId), eq(notifications.kind, 'trainer_daily')))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.payload).toEqual({ expiring: 1, pain: 1 })

  // Повторный запуск в тот же день — без второй сводки.
  await sendTrainerDaily(NOW)
  const again = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, world.trainerId))
  expect(again).toHaveLength(1)
})
