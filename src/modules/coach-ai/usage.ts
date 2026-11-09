import { and, eq, sql } from 'drizzle-orm'
import { getGym } from '@/modules/gym'
import { db } from '@/shared/db'
import { dayKey } from '@/shared/dates'
import { aiUsageDaily } from './schema'

export type UsageInput = {
  model: string
  tokensIn: number
  tokensOut: number
  /** Сообщения клиента считаются в дневной лимит; итоги и голос — нет. */
  countsTowardLimit: boolean
}

export type UsageDeps = {
  now?: Date
  timeZone?: string
  prices?: Record<string, { inPer1k: number; outPer1k: number }>
}

async function usageContext(
  deps: UsageDeps,
): Promise<{ date: string; prices: UsageDeps['prices'] }> {
  const now = deps.now ?? new Date()
  let timeZone = deps.timeZone

  if (!timeZone || !deps.prices) {
    const gym = await getGym()
    timeZone ??= gym.timezone
    deps.prices ??= gym.settings.aiPrices
  }

  return { date: dayKey(now, timeZone), prices: deps.prices ?? {} }
}

/** Стоимость вызова в рублях по таблице цен зала. Нет цены — 0. */
export function costRubFor(
  model: string,
  tokensIn: number,
  tokensOut: number,
  prices: Record<string, { inPer1k: number; outPer1k: number }> = {},
): number {
  const price = prices[model]
  if (!price) return 0

  const cost = (tokensIn / 1000) * price.inPer1k + (tokensOut / 1000) * price.outPer1k
  return Math.round(cost * 100) / 100
}

/** Записывает токены и стоимость дня (чат, итоги, голос). */
export async function recordUsage(
  userId: string,
  input: UsageInput,
  deps: UsageDeps = {},
): Promise<void> {
  const { date, prices } = await usageContext(deps)
  const costRub = costRubFor(input.model, input.tokensIn, input.tokensOut, prices)
  const messageIncrement = input.countsTowardLimit ? 1 : 0
  const tokenIncrement = input.tokensIn + input.tokensOut

  await db
    .insert(aiUsageDaily)
    .values({
      userId,
      date,
      messages: messageIncrement,
      tokens: tokenIncrement,
      costRub,
    })
    .onConflictDoUpdate({
      target: [aiUsageDaily.userId, aiUsageDaily.date],
      set: {
        messages: sql`${aiUsageDaily.messages} + ${messageIncrement}`,
        tokens: sql`${aiUsageDaily.tokens} + ${tokenIncrement}`,
        costRub: sql`${aiUsageDaily.costRub} + ${costRub}`,
        updatedAt: new Date(),
      },
    })
}

/** Сумма стоимости ИИ за месяц `YYYY-MM` (по записям `ai_usage_daily`). */
export async function getUsageTotalForMonth(month: string): Promise<number> {
  const [row] = await db
    .select({ sum: sql<number>`coalesce(sum(${aiUsageDaily.costRub}), 0)` })
    .from(aiUsageDaily)
    .where(sql`${aiUsageDaily.date} like ${`${month}%`}`)

  return Math.round(Number(row?.sum ?? 0) * 100) / 100
}

/** Сколько сообщений клиент отправил за календарные сутки по Красноярску. */
export async function getTodayUsage(
  userId: string,
  now: Date = new Date(),
  timeZone?: string,
): Promise<{ messages: number }> {
  const zone = timeZone ?? (await getGym()).timezone
  const [row] = await db
    .select({ messages: aiUsageDaily.messages })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.date, dayKey(now, zone))))
    .limit(1)

  return { messages: row?.messages ?? 0 }
}

/** Лимит исчерпан: следующее сообщение сверх лимита не уходит модели. */
export async function isOverLimit(
  userId: string,
  limit: number,
  now: Date = new Date(),
): Promise<boolean> {
  const usage = await getTodayUsage(userId, now)
  return usage.messages >= limit
}

/**
 * Занимает одно сообщение из дневного лимита атомарно: параллельные запросы
 * не могут проскочить мимо лимита. `false` — лимит исчерпан, слот не занят.
 */
export async function reserveMessage(
  userId: string,
  limit: number,
  now: Date = new Date(),
  timeZone?: string,
): Promise<boolean> {
  const zone = timeZone ?? (await getGym()).timezone
  const date = dayKey(now, zone)

  if (limit <= 0) return false

  const rows = await db
    .insert(aiUsageDaily)
    .values({ userId, date, messages: 1 })
    .onConflictDoUpdate({
      target: [aiUsageDaily.userId, aiUsageDaily.date],
      set: { messages: sql`${aiUsageDaily.messages} + 1`, updatedAt: new Date() },
      setWhere: sql`${aiUsageDaily.messages} < ${limit}`,
    })
    .returning({ messages: aiUsageDaily.messages })

  return rows.length > 0
}

/** Возвращает слот, занятый `reserveMessage`, если ответа не было (ИИ недоступен). */
export async function releaseMessage(
  userId: string,
  now: Date = new Date(),
  timeZone?: string,
): Promise<void> {
  const zone = timeZone ?? (await getGym()).timezone

  await db
    .update(aiUsageDaily)
    .set({ messages: sql`greatest(${aiUsageDaily.messages} - 1, 0)`, updatedAt: new Date() })
    .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.date, dayKey(now, zone))))
}
