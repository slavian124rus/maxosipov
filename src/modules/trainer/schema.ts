import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Заметки тренера о клиенте (ARCHITECTURE.md §7). Видимость задаёт автор. */
export const trainerNotes = pgTable(
  'trainer_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').notNull(),
    authorId: uuid('author_id').notNull(),
    text: text('text').notNull(),
    visibleToClient: boolean('visible_to_client').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('trainer_notes_client_idx').on(table.clientId, table.createdAt)],
)

export type TrainerNote = typeof trainerNotes.$inferSelect