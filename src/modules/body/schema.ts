import { date, doublePrecision, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * Замеры тела клиента. `date` — день по часовому поясу зала,
 * одна запись на дату (повторный ввод объединяет поля).
 */
export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    date: date('date').notNull(),
    weightKg: doublePrecision('weight_kg'),
    chestCm: doublePrecision('chest_cm'),
    waistCm: doublePrecision('waist_cm'),
    hipsCm: doublePrecision('hips_cm'),
    bicepsCm: doublePrecision('biceps_cm'),
    thighCm: doublePrecision('thigh_cm'),
    enteredBy: uuid('entered_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('body_measurements_user_date_unique').on(table.userId, table.date),
    index('body_measurements_user_date_idx').on(table.userId, table.date),
  ],
)

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert

/** Прогресс-фото: одна запись на снимок, ссылки выдаются подписанные. */
export const progressPhotos = pgTable(
  'progress_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    date: date('date').notNull(),
    pose: text('pose').$type<'front' | 'side' | 'back'>().notNull(),
    mediaId: uuid('media_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('progress_photos_user_date_idx').on(table.userId, table.date)],
)

export type ProgressPhoto = typeof progressPhotos.$inferSelect