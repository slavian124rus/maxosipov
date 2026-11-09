import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Правила прогрессии весов — живут в настройках зала, считает их модуль `progression`. */
export type ProgressionRules = {
  sessionsToIncrease: number
  fastTrackOnEasy: boolean
  failSessionsToDrop: number
  dropPercent: number
}

/** Бренд — настройки, а не код: позже переключаемся на «KOLIZEY TEAM × Максим». */
export type GymBrand = {
  name: string
  shortName: string
  colors: { accent: string }
  logoUrl: string | null
}

export type GymSettings = {
  trialDays: number
  subscriptionPriceRub: number | null
  aiDailyLimit: number
  progressionRules: ProgressionRules
  aiMemo: string
  /** Цены ИИ за 1k токенов по модели; пусто — стоимость не считается (нули). */
  aiPrices?: Record<string, { inPer1k: number; outPer1k: number }>
  /** Главный тренер: его получают новые клиенты (а не «первый с ролью по названию» — ревью F6). */
  headTrainerId?: string | null
  /** Контакты Максима для экрана «нет доступа». */
  contacts?: {
    phone: string | null
    photoUrl: string | null
  }
}

export const gyms = pgTable('gyms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  timezone: text('timezone').notNull().default('Asia/Krasnoyarsk'),
  brand: jsonb('brand').$type<GymBrand>().notNull(),
  settings: jsonb('settings').$type<GymSettings>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Gym = typeof gyms.$inferSelect
export type NewGym = typeof gyms.$inferInsert
