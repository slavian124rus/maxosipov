import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Откуда пришла заявка. Пока источник один — лендинг. */
export type LeadSource = 'landing'

/**
 * Заявки с лендинга (ARCHITECTURE.md §7, «Лендинг»): человек оставил контакт,
 * не регистрируясь. Плюс `ip` для лимита и `consent_at` для 152-ФЗ.
 */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Нормализованный E.164 — по нему ищем дубли. */
    phone: text('phone').notNull(),
    source: text('source').$type<LeadSource>().notNull().default('landing'),
    /** Последний адрес из `X-Forwarded-For` (ревью этапа 1, F7). */
    ip: text('ip').notNull(),
    /** Время согласия на обработку персональных данных. */
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    /** Отметка «Связался» в кабинете тренера. */
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('leads_ip_created_idx').on(table.ip, table.createdAt),
    index('leads_phone_created_idx').on(table.phone, table.createdAt),
  ],
)

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
