import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/** События для клиента и тренера (ARCHITECTURE.md §14). */
export type NotificationKind =
  | 'sub_ends_3d'
  | 'sub_ended'
  | 'program_updated'
  | 'client_pain'
  | 'ai_change_accepted'
  | 'new_client'
  | 'new_lead'
  | 'trainer_daily'

/** Данные события: набор полей зависит от вида, лишние игнорируются. */
export type NotificationData = {
  name?: string
  text?: string
  clientId?: string
  line?: string
  trialUntil?: string
  phone?: string
  expiring?: number
  pain?: number
}

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').$type<NotificationKind>().notNull(),
    payload: jsonb('payload').$type<NotificationData>().notNull().default({}),
    /** Ключ идемпотентности плановых уведомлений: повторная задача не создаёт второе. */
    dedupeKey: text('dedupe_key'),
    /** Когда push реально ушёл; `null` — только в приложении. */
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('notifications_dedupe_key_unique').on(table.dedupeKey),
  ],
)

/** Подписки устройства на Web Push (VAPID). Ключи приходят из `PushSubscription.toJSON()`. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
    index('push_subscriptions_user_idx').on(table.userId),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect