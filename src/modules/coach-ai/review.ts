import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { can, permissionScope, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
import {
  aiProposals,
  applyPatch,
  diffPrograms,
  getProgramTree,
  programs,
  type ProgramDiffLine,
  type ProgramPatch,
} from '@/modules/training'
import { aiMessages } from './schema'

export type FlagContextLine = { role: 'user' | 'assistant'; content: string; flagged: string | null }

export type AiFlagView = {
  id: string
  clientId: string
  clientName: string
  text: string
  flagged: 'pain' | 'injury'
  createdAt: Date
  resolvedAt: Date | null
  /** Сообщения вокруг жалобы (±3), чтобы Максим понял контекст. */
  context: FlagContextLine[]
}

export type TrainerProposalItem = {
  id: string
  clientId: string
  clientName: string
  line: string
  createdAt: Date
  trainerSeenAt: Date | null
}

/** Жалоба для ленты «Сегодня» — без контекста, его тренер увидит в карточке. */
export type TrainerFlagItem = {
  id: string
  clientId: string
  clientName: string
  text: string
  flagged: 'pain' | 'injury'
  createdAt: Date
}

async function clientTarget(
  clientId: string,
): Promise<{ clientId: string; clientTrainerId: string | null }> {
  const [client] = await db
    .select({ trainerId: users.trainerId })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1)

  return { clientId, clientTrainerId: client?.trainerId ?? null }
}

/** Право тренера видеть жалобы и предложения клиента; иначе 404 (не подтверждаем существование). */
async function assertFlagAccess(actor: Actor, clientId: string): Promise<void> {
  if (!can(actor, 'clients.view_ai_flags', await clientTarget(clientId))) {
    throw new NotFoundError('Клиент не найден')
  }
}

/** Жалобы клиента с контекстом ±3 сообщения. Полная переписка не отдаётся (ARCHITECTURE.md §9.9). */
export async function listFlaggedMessages(
  actor: Actor,
  clientId: string,
  limit = 20,
): Promise<AiFlagView[]> {
  await assertFlagAccess(actor, clientId)

  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1)

  const flaggedRows = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.userId, clientId), inArray(aiMessages.flagged, ['pain', 'injury'])))
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit)

  const views: AiFlagView[] = []

  for (const row of flaggedRows) {
    const conversation = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        flagged: aiMessages.flagged,
      })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, row.conversationId))
      .orderBy(asc(aiMessages.createdAt))

    const index = conversation.findIndex((item) => item.id === row.id)
    const around = conversation.slice(Math.max(0, index - 3), index + 4)

    views.push({
      id: row.id,
      clientId,
      clientName: client?.name ?? 'Клиент',
      text: row.content,
      flagged: row.flagged as 'pain' | 'injury',
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      context: around.map((item) => ({
        role: item.role,
        content: item.content,
        flagged: item.flagged ?? null,
      })),
    })
  }

  return views
}

/** Сколько сообщений клиентов МаксИИму с момента `since` — статистика кабинета. */
export async function countUserMessagesSince(userIds: string[], since: Date): Promise<number> {
  if (userIds.length === 0) return 0

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiMessages)
    .where(
      and(eq(aiMessages.role, 'user'), inArray(aiMessages.userId, userIds), gte(aiMessages.createdAt, since)),
    )

  return row?.count ?? 0
}

/** Жалобы всех видимых клиентов — лента «Сегодня» тренера. */
export async function listTrainerFlags(
  actor: Actor,
  options: { unresolvedOnly?: boolean; limit?: number } = {},
): Promise<TrainerFlagItem[]> {
  const scope = permissionScope(actor, 'clients.view_ai_flags')
  if (scope === null) return []

  const rows = await db
    .select({
      id: aiMessages.id,
      clientId: aiMessages.userId,
      clientName: users.name,
      text: aiMessages.content,
      flagged: aiMessages.flagged,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .innerJoin(users, eq(users.id, aiMessages.userId))
    .where(
      and(
        inArray(aiMessages.flagged, ['pain', 'injury']),
        options.unresolvedOnly ? isNull(aiMessages.resolvedAt) : undefined,
        isNull(users.deletedAt),
        eq(users.gymId, actor.gymId),
        scope === 'own' ? eq(users.trainerId, actor.id) : undefined,
      ),
    )
    .orderBy(desc(aiMessages.createdAt))
    .limit(options.limit ?? 20)

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName || 'Клиент',
    text: row.text,
    flagged: row.flagged as 'pain' | 'injury',
    createdAt: row.createdAt,
  }))
}

/** «Разобрался»: жалоба исчезает из ленты. Право `clients.view_ai_flags` на клиента. */
export async function resolveFlag(actor: Actor, messageId: string): Promise<void> {
  const [message] = await db.select().from(aiMessages).where(eq(aiMessages.id, messageId)).limit(1)
  if (!message || !message.flagged) throw new NotFoundError('Жалоба не найдена')

  await assertFlagAccess(actor, message.userId)

  await db
    .update(aiMessages)
    .set({ resolvedAt: new Date(), resolvedBy: actor.id, updatedAt: new Date() })
    .where(eq(aiMessages.id, messageId))
}

/** «Приняли изменения МаксИИма»: тренер посмотрел предложение — из ленты оно уходит. */
export async function markProposalSeen(actor: Actor, proposalId: string): Promise<void> {
  const [proposal] = await db
    .select()
    .from(aiProposals)
    .where(eq(aiProposals.id, proposalId))
    .limit(1)

  if (!proposal) throw new NotFoundError('Предложение не найдено')

  await assertFlagAccess(actor, proposal.userId)

  await db
    .update(aiProposals)
    .set({ trainerSeenAt: proposal.trainerSeenAt ?? new Date(), updatedAt: new Date() })
    .where(eq(aiProposals.id, proposalId))
}

/** Первая строка диффа предложения — то, что Максим видит в ленте. */
async function proposalLine(payload: unknown, programId: string | null): Promise<string> {
  if (!programId) return ''

  const program = await getProgramTree(programId)
  if (!program) return ''

  try {
    const published = new Set(
      program.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    )
    const after = applyPatch(program, payload as ProgramPatch, published)
    const ids = [
      ...program.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
      ...after.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    ]

    const names = await db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(inArray(exercises.id, [...new Set(ids)]))

    const map = new Map(names.map((row) => [row.id, row.name]))
    const lines: ProgramDiffLine[] = diffPrograms(program, after, (id) => map.get(id) ?? id)

    return lines[0]?.text ?? ''
  } catch {
    return ''
  }
}

/**
 * Принятые изменения МаксИИма в программах тренера: лента «Сегодня» и вкладка «МаксИИм».
 * Область прав и «программа тренера» проверяются в самом запросе, чтобы `limit` резал уже
 * отфильтрованные строки: иначе чужие изменения вытесняли бы свои из первых N.
 */
export async function listAcceptedProposals(
  actor: Actor,
  options: { unseenOnly?: boolean; clientId?: string; limit?: number } = {},
): Promise<TrainerProposalItem[]> {
  const scope = permissionScope(actor, 'clients.view_ai_flags')
  if (scope === null) return []

  const rows = await db
    .select({
      id: aiProposals.id,
      clientId: aiProposals.userId,
      clientName: users.name,
      programId: aiProposals.programId,
      payload: aiProposals.payload,
      diff: aiProposals.diff,
      createdAt: aiProposals.createdAt,
      trainerSeenAt: aiProposals.trainerSeenAt,
    })
    .from(aiProposals)
    .innerJoin(users, eq(users.id, aiProposals.userId))
    .innerJoin(programs, eq(programs.id, aiProposals.programId))
    .where(
      and(
        eq(aiProposals.status, 'accepted'),
        // Только программы, которые ведёт тренер: свои клиентские изменения ему не нужны.
        eq(programs.authorKind, 'trainer'),
        isNull(users.deletedAt),
        eq(users.gymId, actor.gymId),
        scope === 'own' ? eq(users.trainerId, actor.id) : undefined,
        options.unseenOnly ? isNull(aiProposals.trainerSeenAt) : undefined,
        options.clientId ? eq(aiProposals.userId, options.clientId) : undefined,
      ),
    )
    .orderBy(desc(aiProposals.createdAt))
    .limit(options.limit ?? 20)

  const items: TrainerProposalItem[] = []

  for (const row of rows) {
    items.push({
      id: row.id,
      clientId: row.clientId,
      clientName: row.clientName,
      line: await proposalLine(row.payload ?? row.diff, row.programId),
      createdAt: row.createdAt,
      trainerSeenAt: row.trainerSeenAt,
    })
  }

  return items
}
