import { desc, sql } from 'drizzle-orm'
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export type AuthorKind = 'trainer' | 'client' | 'client_ai'
export type ProgramStatus = 'active' | 'archived'
export type WorkoutMode = 'free' | 'guided'
export type Feeling = 'easy' | 'good' | 'hard'
export type ChangeActorKind = 'trainer' | 'client' | 'ai_proposal_accepted'
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'reverted'
export type ProposalKind = 'patch' | 'new_program'

import type { ProgramAudience, ProgramGoal } from '@/shared/program-labels'

export type { ProgramAudience, ProgramGoal }

/** Программа клиента или шаблон (`owner_id = null`). */
export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull(),
    ownerId: uuid('owner_id'),
    authorId: uuid('author_id').notNull(),
    authorKind: text('author_kind').$type<AuthorKind>().notNull().default('trainer'),
    name: text('name').notNull(),
    goal: text('goal').$type<ProgramGoal>(),
    /** Только у шаблонов: для кого он и его номер в зале («Шаблон №3»). */
    audience: text('audience').$type<ProgramAudience>(),
    templateNumber: integer('template_number'),
    status: text('status').$type<ProgramStatus>().notNull().default('active'),
    sourceTemplateId: uuid('source_template_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Одна активная программа на клиента (F14).
    uniqueIndex('programs_one_active_per_owner')
      .on(table.ownerId)
      .where(sql`${table.status} = 'active' AND ${table.ownerId} IS NOT NULL`),
    // Номера шаблонов не повторяются в зале (F14: параллельное создание даст 23505).
    uniqueIndex('programs_template_number_unique')
      .on(table.gymId, table.templateNumber)
      .where(sql`${table.ownerId} IS NULL AND ${table.templateNumber} IS NOT NULL`),
  ],
)

export const programDays = pgTable('program_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const programExercises = pgTable('program_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayId: uuid('day_id')
    .notNull()
    .references(() => programDays.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  exerciseId: uuid('exercise_id').notNull(),
  sets: integer('sets').notNull().default(3),
  repMin: integer('rep_min').notNull().default(10),
  repMax: integer('rep_max').notNull().default(12),
  restSec: integer('rest_sec').notNull().default(90),
  targetWeightKg: doublePrecision('target_weight_kg'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Тренировка. `client_uuid` приходит с клиента и делает старт идемпотентным. */
export const workoutSessions = pgTable(
  'workout_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    programDayId: uuid('program_day_id'),
    mode: text('mode').$type<WorkoutMode>().notNull().default('free'),
    clientUuid: text('client_uuid').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    comment: text('comment'),
    aiSummary: text('ai_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('workout_sessions_client_uuid_unique').on(table.clientUuid),
    index('workout_sessions_user_started_idx').on(table.userId, desc(table.startedAt)),
    index('workout_sessions_user_finished_idx')
      .on(table.userId)
      .where(sql`${table.finishedAt} IS NOT NULL`),
  ],
)

/** Подход. `client_uuid` — ключ идемпотентности при офлайн-синхронизации. */
export const setLogs = pgTable(
  'set_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').notNull(),
    setIndex: integer('set_index').notNull(),
    weightKg: doublePrecision('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    feeling: text('feeling').$type<Feeling>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    loggedOffline: integer('logged_offline').notNull().default(0),
    clientUuid: text('client_uuid').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('set_logs_client_uuid_unique').on(table.clientUuid),
    index('set_logs_session_idx').on(table.sessionId),
    index('set_logs_exercise_idx').on(table.exerciseId),
  ],
)

/** «Вес на следующий раз» — то, что клиент принял после упражнения. */
export const nextWeights = pgTable(
  'next_weights',
  {
    userId: uuid('user_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    weightKg: doublePrecision('weight_kg').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.exerciseId] })],
)

export type NextWeight = typeof nextWeights.$inferSelect

/** История изменений программы: кто, когда и что поменял. */
export const programChanges = pgTable('program_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id'),
  actorKind: text('actor_kind').$type<ChangeActorKind>().notNull(),
  diff: jsonb('diff').$type<unknown>().notNull(),
  /** Полные снимки дерева до и после — по ним работает откат изменения МаксИИма. */
  before: jsonb('before').$type<unknown>(),
  after: jsonb('after').$type<unknown>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Предложения МаксИИма: создаются на этапе 4, таблица нужна для схемы §7. */
export const aiProposals = pgTable('ai_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  programId: uuid('program_id'),
  kind: text('kind').$type<ProposalKind>().notNull().default('patch'),
  diff: jsonb('diff').$type<unknown>().notNull(),
  /** Для `patch` — `ProgramPatch`; для `new_program` — черновик программы. */
  payload: jsonb('payload').$type<unknown>(),
  conversationId: uuid('conversation_id'),
  rationale: text('rationale'),
  status: text('status').$type<ProposalStatus>().notNull().default('pending'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  trainerSeenAt: timestamp('trainer_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Program = typeof programs.$inferSelect
export type ProgramDay = typeof programDays.$inferSelect
export type ProgramExerciseRow = typeof programExercises.$inferSelect
export type WorkoutSession = typeof workoutSessions.$inferSelect
export type SetLog = typeof setLogs.$inferSelect
export type ProgramChange = typeof programChanges.$inferSelect