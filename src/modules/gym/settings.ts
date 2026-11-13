import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { aiMessages } from '@/modules/coach-ai'
import { gyms, type AiModels, type Gym, type GymBrand, type GymSettings, type ProgressionRules } from './schema'
import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB')

const priceSchema = z.record(
  z.string().min(1),
  z.object({
    inPer1k: z.number().min(0, 'Цена не может быть отрицательной').max(100_000, 'Цена слишком большая'),
    outPer1k: z.number().min(0, 'Цена не может быть отрицательной').max(100_000, 'Цена слишком большая'),
  }),
)

export const aiSettingsSchema = z.object({
  aiMemo: z.string().max(2000, 'Памятка — не длиннее 2000 символов'),
  aiDailyLimit: z
    .number()
    .int('Лимит — целое число')
    .min(0, 'Лимит сообщений — от 0 до 200 в сутки')
    .max(200, 'Лимит сообщений — от 0 до 200 в сутки'),
  aiPrices: priceSchema,
  aiModels: z
    .object({
      chat: z.string().trim().max(120, 'Id модели — до 120 символов').optional(),
      templates: z.string().trim().max(120, 'Id модели — до 120 символов').optional(),
      exercises: z.string().trim().max(120, 'Id модели — до 120 символов').optional(),
      quick: z.string().trim().max(120, 'Id модели — до 120 символов').optional(),
      fallback: z.string().trim().max(120, 'Id модели — до 120 символов').optional(),
    })
    .optional(),
})

export const progressionRulesSchema = z.object({
  sessionsToIncrease: z
    .number()
    .int()
    .min(1, 'Тренировок подряд для повышения — от 1 до 5')
    .max(5, 'Тренировок подряд для повышения — от 1 до 5'),
  fastTrackOnEasy: z.boolean(),
  failSessionsToDrop: z
    .number()
    .int()
    .min(1, 'Тренировок с недобором для снижения — от 1 до 5')
    .max(5, 'Тренировок с недобором для снижения — от 1 до 5'),
  dropPercent: z
    .number()
    .int()
    .min(5, 'Снижение веса — от 5 до 30 %')
    .max(30, 'Снижение веса — от 5 до 30 %'),
})

export const brandSchema = z.object({
  name: z.string().trim().min(1, 'Укажи название').max(80, 'Название — до 80 символов'),
  shortName: z.string().trim().min(1, 'Укажи короткое имя').max(40, 'Короткое имя — до 40 символов'),
  accent: hexColor,
  logoMediaId: z.string().uuid().nullable().optional(),
})

export const contactsSchema = z.object({
  phone: z.string().trim().max(30, 'Телефон слишком длинный').nullable(),
  photoMediaId: z.string().uuid().nullable().optional(),
})

export type AiSettingsInput = z.infer<typeof aiSettingsSchema>
export type BrandInput = z.infer<typeof brandSchema>
export type ContactsInput = z.infer<typeof contactsSchema>

async function loadGym(): Promise<Gym> {
  const [gym] = await db.select().from(gyms).limit(1)
  if (!gym) throw new Error('Зал не найден')
  return gym
}

async function saveSettings(gym: Gym, settings: GymSettings): Promise<void> {
  await db.update(gyms).set({ settings, updatedAt: new Date() }).where(eq(gyms.id, gym.id))
}

/** Памятка МаксИИма, дневной лимит и цены моделей (право `settings.ai`). */
export async function updateAiSettings(actor: Actor, input: AiSettingsInput): Promise<GymSettings> {
  assertCan(actor, 'settings.ai')
  const data = aiSettingsSchema.parse(input)
  const gym = await loadGym()

  const settings: GymSettings = {
    ...gym.settings,
    aiMemo: data.aiMemo,
    aiDailyLimit: data.aiDailyLimit,
    aiPrices: data.aiPrices,
    // Пустые поля убираем: для них действует значение по умолчанию.
    ...(data.aiModels
      ? {
          aiModels: Object.fromEntries(
            Object.entries(data.aiModels).filter(([, value]) => Boolean(value)),
          ) as AiModels,
        }
      : {}),
  }

  await saveSettings(gym, settings)
  return settings
}

/** Правила прогрессии весов (право `settings.progression`). */
export async function updateProgressionRules(
  actor: Actor,
  rules: ProgressionRules,
): Promise<GymSettings> {
  assertCan(actor, 'settings.progression')
  const data = progressionRulesSchema.parse(rules)
  const gym = await loadGym()

  const settings: GymSettings = { ...gym.settings, progressionRules: data }
  await saveSettings(gym, settings)
  return settings
}

/** Бренд — настройки, а не код (CLAUDE.md §2.10). */
export async function updateBrand(actor: Actor, input: BrandInput): Promise<GymBrand> {
  assertCan(actor, 'settings.brand')
  const data = brandSchema.parse(input)
  const gym = await loadGym()

  const brand: GymBrand = {
    name: data.name,
    shortName: data.shortName,
    colors: { accent: data.accent },
    logoUrl: data.logoMediaId ? `/media/${data.logoMediaId}` : gym.brand.logoUrl,
  }

  await db.update(gyms).set({ brand, updatedAt: new Date() }).where(eq(gyms.id, gym.id))
  return brand
}

/** Контакты Максима для экрана «нет доступа» (право `settings.brand`). */
export async function updateContacts(actor: Actor, input: ContactsInput): Promise<GymSettings> {
  assertCan(actor, 'settings.brand')
  const data = contactsSchema.parse(input)
  const gym = await loadGym()

  const settings: GymSettings = {
    ...gym.settings,
    contacts: {
      phone: data.phone,
      photoUrl: gym.settings.contacts?.photoUrl ?? null,
      photoMediaId: data.photoMediaId ?? null,
    },
  }

  await saveSettings(gym, settings)
  return settings
}

export type AiSpend = {
  byModel: { model: string; tokensIn: number; tokensOut: number; costRub: number }[]
  totalRub: number
}

/** Месяц `YYYY-MM` по Красноярску → границы в UTC. */
function monthBounds(month: string): { from: Date; to: Date } {
  const [year, index] = month.split('-').map(Number)
  const from = new Date(Date.UTC(year!, index! - 1, 1) - 7 * 60 * 60 * 1000)
  const to = new Date(Date.UTC(index! === 12 ? year! + 1 : year!, index! === 12 ? 0 : index!, 1) - 7 * 60 * 60 * 1000)

  return { from, to }
}

/** Расход за месяц: токены по моделям и стоимость (право `settings.ai`). */
export async function getAiSpend(actor: Actor, month: string): Promise<AiSpend> {
  assertCan(actor, 'settings.ai')
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Месяц в формате ГГГГ-ММ')

  const gym = await loadGym()
  const prices = gym.settings.aiPrices ?? {}
  const { from, to } = monthBounds(month)

  const rows = await db
    .select({
      model: sql<string>`coalesce(${aiMessages.model}, 'unknown')`,
      tokensIn: sql<number>`coalesce(sum(${aiMessages.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${aiMessages.tokensOut}), 0)::int`,
    })
    .from(aiMessages)
    .where(and(gte(aiMessages.createdAt, from), lt(aiMessages.createdAt, to)))
    .groupBy(sql`coalesce(${aiMessages.model}, 'unknown')`)

  const byModel = rows.map((row) => {
    const price = prices[row.model]
    const costRub = price
      ? Math.round(((row.tokensIn / 1000) * price.inPer1k + (row.tokensOut / 1000) * price.outPer1k) * 100) / 100
      : 0

    return { model: row.model, tokensIn: row.tokensIn, tokensOut: row.tokensOut, costRub }
  })

  // Динамический импорт разрывает цикл gym ↔ coach-ai (оба модуля публичные).
  const { getUsageTotalForMonth } = await import('@/modules/coach-ai')
  const totalRub = await getUsageTotalForMonth(month)

  return { byModel, totalRub }
}