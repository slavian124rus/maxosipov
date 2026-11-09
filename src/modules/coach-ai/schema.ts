import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export type AiRole = 'user' | 'assistant'
export type AiFlag = 'pain' | 'injury'

/** Диалог МаксИИма с клиентом (ARCHITECTURE.md §7). */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_conversations_user_idx').on(table.userId, table.updatedAt)],
)

/** Сообщение диалога: текст, вызовы инструментов, флаг боли, токены и модель. */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: text('role').$type<AiRole>().notNull(),
    content: text('content').notNull(),
    toolCalls: jsonb('tool_calls').$type<unknown>(),
    flagged: text('flagged').$type<AiFlag>(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_messages_conversation_idx').on(table.conversationId, table.createdAt)],
)

/** Расход по дням: сообщения лимита, токены и стоимость в рублях. */
export const aiUsageDaily = pgTable(
  'ai_usage_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** Календарный день в часовом поясе зала, `YYYY-MM-DD`. */
    date: text('date').notNull(),
    messages: integer('messages').notNull().default(0),
    tokens: integer('tokens').notNull().default(0),
    costRub: doublePrecision('cost_rub').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('ai_usage_daily_user_date_unique').on(table.userId, table.date)],
)

export type AiConversation = typeof aiConversations.$inferSelect
export type AiMessage = typeof aiMessages.$inferSelect
export type AiUsageDailyRow = typeof aiUsageDaily.$inferSelect
