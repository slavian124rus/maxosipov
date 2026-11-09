import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** События для клиента и тренера (ARCHITECTURE.md §14). Push добавит этап 5. */
export type NotificationKind = 'client_pain' | 'ai_proposal_accepted'

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').$type<NotificationKind>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)],
)

export type Notification = typeof notifications.$inferSelect