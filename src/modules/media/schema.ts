import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export type MediaKind = 'exercise_video' | 'photo' | 'progress_photo'
export type MediaStatus = 'uploaded' | 'processing' | 'ready' | 'failed'

export type ProcessedPaths = {
  mp4?: string
  webm?: string
  poster?: string
  musclesMp4?: string
}

export type ProcessingOptions = {
  /** Доля кадра по горизонтали, вокруг которой центрируем кроп 9:16. */
  cropX: number
  loopStart?: number
  loopEnd?: number
}

/** Загруженный файл и результаты обработки. Пути — относительно `MEDIA_ROOT`. */
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').$type<MediaKind>().notNull(),
  ownerId: uuid('owner_id').notNull(),
  status: text('status').$type<MediaStatus>().notNull().default('uploaded'),
  originalPath: text('original_path'),
  processedPaths: jsonb('processed_paths').$type<ProcessedPaths>(),
  error: text('error'),
  sizeBytes: integer('size_bytes').notNull(),
  mime: text('mime').notNull(),
  receivedChunks: integer('received_chunks').array().notNull().default([]),
  totalChunks: integer('total_chunks').notNull(),
  processingOptions: jsonb('processing_options').$type<ProcessingOptions>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Media = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert
