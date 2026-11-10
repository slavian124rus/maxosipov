import type { PgBoss } from 'pg-boss'
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { aiMessages } from '@/modules/coach-ai'
import { getGym, getHeadTrainerId } from '@/modules/gym'
import { notify } from '@/modules/notifications'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { roles } from '@/modules/rbac'
import { subscriptions } from '@/modules/access'
import { dayKey } from '@/shared/dates'

export const REMINDERS_CLIENTS_QUEUE = 'reminders.clients'
export const REMINDERS_CLIENTS_CRON = '0 10 * * *'
export const REMINDERS_TRAINER_QUEUE = 'reminders.trainer'
export const REMINDERS_TRAINER_CRON = '0 9 * * *'

/** Плановые уведомления считаются по времени зала (ARCHITECTURE.md §14). */
const TZ = 'Asia/Krasnoyarsk'
const DAY_MS = 24 * 60 * 60 * 1000
const ENDING_DAYS = 7

/** Напоминание «закончилась» шлём, пока с конца доступа прошло не больше этого срока. */
const ENDED_WINDOW_DAYS = 2

/** «Осталось 3 дня» — текст из плана дословный, поэтому шлём ровно за 3 дня до конца. */
const ENDING_REMINDER_DAYS = 3

/**
 * Клиентам: «заканчивается через 3 дня» и «закончилась».
 * `dedupeKey` содержит дату окончания — повторный запуск задачи ничего не дублирует.
 *
 * Почему в выборке и `expired`: задача `subscriptions.expire` раз в час переводит истёкшие
 * `trial`/`active` в `expired`, к 10:00 «закончившиеся» подписки уже в этом статусе.
 * Замороженные и отключённые подписки напоминаний не получают.
 */
export async function sendClientReminders(now: Date = new Date()): Promise<{ ending: number; ended: number }> {
  const gym = await getGym()
  const timeZone = gym.timezone || TZ

  const rows = await db
    .select({ userId: subscriptions.userId, status: subscriptions.status, endsAt: subscriptions.endsAt })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.status, ['trial', 'active', 'expired']),
        gte(subscriptions.endsAt, new Date(now.getTime() - ENDED_WINDOW_DAYS * DAY_MS)),
        lte(subscriptions.endsAt, new Date(now.getTime() + ENDING_REMINDER_DAYS * DAY_MS)),
        isNull(users.deletedAt),
      ),
    )

  let ending = 0
  let ended = 0

  for (const row of rows) {
    const date = dayKey(row.endsAt, timeZone)

    if (row.endsAt.getTime() <= now.getTime()) {
      await notify(row.userId, 'sub_ended', {}, `subend:${row.userId}:${date}`)
      ended += 1
      continue
    }

    const left = Math.ceil((row.endsAt.getTime() - now.getTime()) / DAY_MS)
    if (row.status !== 'expired' && left === ENDING_REMINDER_DAYS) {
      await notify(row.userId, 'sub_ends_3d', {}, `sub3d:${row.userId}:${date}`)
      ending += 1
    }
  }

  return { ending, ended }
}

/** Тренеру: сводка на сегодня (истекающий доступ и все неразобранные жалобы, как в ленте). */
export async function sendTrainerDaily(now: Date = new Date()): Promise<{ expiring: number; pain: number }> {
  const trainerId = await getHeadTrainerId()
  if (!trainerId) return { expiring: 0, pain: 0 }

  const gym = await getGym()
  const timeZone = gym.timezone || TZ
  const until = new Date(now.getTime() + ENDING_DAYS * DAY_MS)

  const expiringRows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.status, ['trial', 'active']),
        lte(subscriptions.endsAt, until),
        gte(subscriptions.endsAt, now),
        isNull(users.deletedAt),
        or(eq(users.trainerId, trainerId), isNull(users.trainerId)),
      ),
    )

  const [painRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiMessages)
    .innerJoin(users, eq(users.id, aiMessages.userId))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(roles.isClient, true),
        or(eq(users.trainerId, trainerId), isNull(users.trainerId)),
        isNull(users.deletedAt),
        sql`${aiMessages.flagged} is not null`,
        isNull(aiMessages.resolvedAt),
      ),
    )

  const expiring = expiringRows.length
  const pain = painRow?.count ?? 0

  await notify(trainerId, 'trainer_daily', { expiring, pain }, `daily:${trainerId}:${dayKey(now, timeZone)}`)

  return { expiring, pain }
}

/** Очереди плановых напоминаний: 10:00 клиентам, 09:00 тренеру по Красноярску. */
export async function registerReminders(boss: PgBoss): Promise<void> {
  await boss.createQueue(REMINDERS_CLIENTS_QUEUE)
  await boss.schedule(REMINDERS_CLIENTS_QUEUE, REMINDERS_CLIENTS_CRON, null, { tz: TZ })
  await boss.work(REMINDERS_CLIENTS_QUEUE, async () => {
    const result = await sendClientReminders()
    console.log(`[worker] reminders.clients: через 3 дня — ${result.ending}, закончилось — ${result.ended}`)
  })

  await boss.createQueue(REMINDERS_TRAINER_QUEUE)
  await boss.schedule(REMINDERS_TRAINER_QUEUE, REMINDERS_TRAINER_CRON, null, { tz: TZ })
  await boss.work(REMINDERS_TRAINER_QUEUE, async () => {
    const result = await sendTrainerDaily()
    console.log(`[worker] reminders.trainer: истекает — ${result.expiring}, жалоб — ${result.pain}`)
  })
}