import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Пользователи. На этом этапе — только сама таблица:
 * вход, сессии и привязка телефона появятся на этапе 1.
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
  workoutMode: text('workout_mode').$type<'free' | 'guided'>().notNull().default('guided'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
