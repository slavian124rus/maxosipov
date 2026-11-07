import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export type SubscriptionStatus = 'trial' | 'active' | 'frozen' | 'expired' | 'disabled'

/** Текущее состояние доступа: одна строка на клиента. История — в `subscription_events`. */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  status: text('status').$type<SubscriptionStatus>().notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  frozenAt: timestamp('frozen_at', { withTimezone: true }),
  statusBeforeFreeze: text('status_before_freeze').$type<SubscriptionStatus>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SubscriptionEventType =
  | 'trial_started'
  | 'granted'
  | 'frozen'
  | 'unfrozen'
  | 'disabled'
  | 'expired'

/** История действий по подписке. Ничего не удаляется. */
export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').$type<SubscriptionEventType>().notNull(),
  months: integer('months'),
  untilDate: timestamp('until_date', { withTimezone: true }),
  priceRub: integer('price_rub'),
  note: text('note'),
  actorId: uuid('actor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Выданные пробные периоды. Хранится `sha256(phone + AUTH_SECRET)` — переживает
 * удаление аккаунта, чтобы один номер не получил пробный месяц дважды.
 */
export const trialRegistry = pgTable('trial_registry', {
  phoneHash: text('phone_hash').primaryKey(),
  usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect
export type TrialRegistryRow = typeof trialRegistry.$inferSelect
