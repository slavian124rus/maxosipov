import { integer, pgTable, real, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import type { MuscleCode, MuscleView } from './muscles'

/** Справочник мышц: фиксированный список DESIGN.md §6.3, заполняется сидом. */
export const muscles = pgTable('muscles', {
  code: text('code').primaryKey(),
  nameRu: text('name_ru').notNull(),
  view: text('view').$type<MuscleView>().notNull(),
  svgLayerId: text('svg_layer_id').notNull(),
})

export type Muscle = typeof muscles.$inferSelect

export type OverlayProfile = 'none' | 'pull_vertical' | 'pull_horizontal'
export type ExerciseStatus = 'draft' | 'published'

/** Тренажёры зала. `weightStepKg` — шаг блина (5 кг у стойки, 2,5 у блочных). */
export const machines = pgTable('machines', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id').notNull(),
  name: text('name').notNull(),
  zone: text('zone'),
  weightStepKg: real('weight_step_kg').notNull().default(5),
  photoMediaId: uuid('photo_media_id'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Machine = typeof machines.$inferSelect
export type NewMachine = typeof machines.$inferInsert

/** Упражнение каталога. Публикуется только с готовым видео, мышцами и шагами. */
export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull(),
    machineId: uuid('machine_id'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    primaryMuscles: text('primary_muscles').array().$type<MuscleCode[]>().notNull().default([]),
    secondaryMuscles: text('secondary_muscles')
      .array()
      .$type<MuscleCode[]>()
      .notNull()
      .default([]),
    videoMediaId: uuid('video_media_id'),
    overlayProfile: text('overlay_profile').$type<OverlayProfile>().notNull().default('none'),
    steps: text('steps').array().notNull().default([]),
    mistakes: text('mistakes').array().notNull().default([]),
    tips: text('tips'),
    defaultRepMin: integer('default_rep_min').notNull().default(8),
    defaultRepMax: integer('default_rep_max').notNull().default(12),
    status: text('status').$type<ExerciseStatus>().notNull().default('draft'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('exercises_gym_slug_unique').on(table.gymId, table.slug)],
)

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert
