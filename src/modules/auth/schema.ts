import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * Пользователи. Телефон — главный ключ (E.164, подтверждён).
 * Вход, сессии и привязка способов входа — в этом же модуле.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  gymId: uuid('gym_id').notNull(),
  roleId: uuid('role_id').notNull(),
  trainerId: uuid('trainer_id').references((): AnyPgColumn => users.id),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  /** Согласие на обработку персональных данных (152-ФЗ). */
  pdConsentAt: timestamp('pd_consent_at', { withTimezone: true }),
  workoutMode: text('workout_mode').$type<'free' | 'guided'>().notNull().default('guided'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Сессии: в базе только `sha256` токена, сам токен живёт в cookie `sid`. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export type AuthProvider = 'vk' | 'yandex' | 'max' | 'phone'

/** Способы входа, привязанные к пользователю. Один провайдерный аккаунт — один пользователь. */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<AuthProvider>().notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('auth_accounts_provider_account_unique').on(table.provider, table.providerUserId)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type AuthAccount = typeof authAccounts.$inferSelect

/** Одноразовые коды входа: в базе только `sha256`, сам код уходит в СМС. */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    ip: text('ip').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('otp_codes_phone_created_idx').on(table.phone, table.createdAt),
    index('otp_codes_ip_created_idx').on(table.ip, table.createdAt),
  ],
)

export type OtpCode = typeof otpCodes.$inferSelect

/**
 * Провайдер не отдал телефон: запоминаем профиль на 15 минут,
 * чтобы после подтверждения номера привязать способ входа.
 */
export const pendingLinks = pgTable('pending_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').$type<Exclude<AuthProvider, 'phone'>>().notNull(),
  providerUserId: text('provider_user_id').notNull(),
  name: text('name'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PendingLink = typeof pendingLinks.$inferSelect

export type PendingLinkData = {
  provider: Exclude<AuthProvider, 'phone'>
  providerUserId: string
  name: string | null
}



