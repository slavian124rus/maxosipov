import { pgTable, text } from 'drizzle-orm/pg-core'
import type { MuscleView } from './muscles'

/** Справочник мышц: фиксированный список DESIGN.md §6.3, заполняется сидом. */
export const muscles = pgTable('muscles', {
  code: text('code').primaryKey(),
  nameRu: text('name_ru').notNull(),
  view: text('view').$type<MuscleView>().notNull(),
  svgLayerId: text('svg_layer_id').notNull(),
})

export type Muscle = typeof muscles.$inferSelect
