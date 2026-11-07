import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { RolePermission } from './permissions'

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  /** Системная роль «Владелец»: неудаляемая, права не урезаются. */
  isSystem: boolean('is_system').notNull().default(false),
  permissions: jsonb('permissions').$type<RolePermission[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Журнал изменений ролей и назначений — ничего не удаляется. */
export const roleAudit = pgTable('role_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  target: text('target'),
  before: jsonb('before').$type<unknown>(),
  after: jsonb('after').$type<unknown>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type RoleAuditEntry = typeof roleAudit.$inferSelect
