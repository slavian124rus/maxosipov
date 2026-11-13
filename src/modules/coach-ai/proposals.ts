import { and, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { assertClientAccess } from '@/modules/access'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { notify } from '@/modules/notifications'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import {
  aiProposals,
  applyPatch,
  applyProgramPatchAs,
  diffPrograms,
  getProgramTree,
  programChanges,
  programDays,
  programExercises,
  programs,
  resolvePlanWeights,
  type ProgramDiffLine,
  type ProgramTree,
  type ProgramPatch,
  type ProposalKind,
  type ProposalStatus,
} from '@/modules/training'

export type DraftProgramPayload = {
  name: string
  days: {
    name: string
    exercises: {
      exerciseId: string
      sets: number
      repMin: number
      repMax: number
      restSec?: number
    }[]
  }[]
  rationale: string | null
}

export type ProposalView = {
  id: string
  kind: ProposalKind
  status: ProposalStatus
  diff: unknown
  payload: unknown
  rationale: string | null
  preview: unknown
  createdAt: Date
}

const ALREADY_DECIDED = 'Уже решено'
const PROGRAM_CHANGED = 'Программа уже изменилась — попроси МаксИИма собрать заново'

async function loadProposal(actor: Actor, proposalId: string) {
  const [proposal] = await db
    .select()
    .from(aiProposals)
    .where(eq(aiProposals.id, proposalId))
    .limit(1)

  if (!proposal) throw new Error('Предложение не найдено')
  if (proposal.userId !== actor.id) throw new ForbiddenError('Это чужое предложение')
  if (proposal.status !== 'pending') throw new Error(ALREADY_DECIDED)

  return proposal
}

async function markDecided(
  actor: Actor,
  proposalId: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  const updated = await db
    .update(aiProposals)
    .set({ status, decidedBy: actor.id, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiProposals.id, proposalId), eq(aiProposals.status, 'pending')))
    .returning({ id: aiProposals.id })

  if (updated.length === 0) throw new Error(ALREADY_DECIDED)
}

/** Тренеру — «{имя} принял изменение МаксИИма» с первой строкой диффа. */
async function notifyTrainerAboutChange(clientId: string, programId: string): Promise<void> {
  try {
    const [client] = await db
      .select({ name: users.name, trainerId: users.trainerId })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1)

    if (!client?.trainerId) return

    const [change] = await db
      .select({ diff: programChanges.diff })
      .from(programChanges)
      .where(eq(programChanges.programId, programId))
      .orderBy(desc(programChanges.createdAt))
      .limit(1)

    const line = (change?.diff as ProgramDiffLine[] | null)?.[0]?.text ?? ''

    await notify(client.trainerId, 'ai_change_accepted', {
      name: client.name,
      line,
      clientId,
    })
  } catch (error) {
    console.error('[coach-ai] не удалось уведомить тренера о принятом изменении', error)
  }
}

/** Принятие предложения: патч применяется к программе, новая программа становится активной. */
export async function acceptProposal(actor: Actor, proposalId: string): Promise<void> {
  const proposal = await loadProposal(actor, proposalId)

  // Меняет программу только клиент с действующим доступом (ARCHITECTURE.md §8.4).
  await assertClientAccess(actor.id)

  // Предложение собрано по старой версии программы — применять его нельзя.
  if (proposal.kind === 'patch' && proposal.programId && proposal.baseProgramUpdatedAt) {
    const [current] = await db
      .select({ updatedAt: programs.updatedAt })
      .from(programs)
      .where(eq(programs.id, proposal.programId))
      .limit(1)

    if (current && current.updatedAt.getTime() > proposal.baseProgramUpdatedAt.getTime()) {
      await db
        .update(aiProposals)
        .set({ status: 'superseded', updatedAt: new Date() })
        .where(and(eq(aiProposals.id, proposalId), eq(aiProposals.status, 'pending')))
      throw new Error(PROGRAM_CHANGED)
    }
  }

  // Статус ставим первым: параллельное повторное нажатие увидит «Уже решено»
  // и не применит изменение дважды.
  await markDecided(actor, proposalId, 'accepted')

  try {
    if (proposal.kind === 'patch') {
      if (!proposal.programId) throw new Error('Программа не найдена')

      const before = await getProgramTree(proposal.programId)

      await applyProgramPatchAs(
        actor,
        proposal.programId,
        (proposal.payload ?? proposal.diff) as ProgramPatch,
        'ai_proposal_accepted',
      )

      // Программа тренера: Максим видит принятое изменение в ленте (без push).
      if (before?.authorKind === 'trainer' && before.ownerId && before.ownerId !== actor.id) {
        await notifyTrainerAboutChange(before.ownerId, proposal.programId)
      }

      return
    }

    const draft = (proposal.payload ?? proposal.diff) as DraftProgramPayload

    await db.transaction(async (tx) => {
      const now = new Date()

      // Веса и отдых прежней программы переезжают в новую по совпадающим упражнениям.
      const previous = await tx
        .select({
          exerciseId: programExercises.exerciseId,
          weightKg: programExercises.targetWeightKg,
          restSec: programExercises.restSec,
        })
        .from(programExercises)
        .innerJoin(programDays, eq(programDays.id, programExercises.dayId))
        .innerJoin(programs, eq(programs.id, programDays.programId))
        .where(and(eq(programs.ownerId, actor.id), eq(programs.status, 'active')))

      const carryWeights: Record<string, number> = {}
      const carryRest = new Map<string, number>()
      for (const row of previous) {
        if ((row.weightKg ?? 0) > 0) carryWeights[row.exerciseId] = row.weightKg!
        carryRest.set(row.exerciseId, row.restSec)
      }

      await tx
        .update(programs)
        .set({ status: 'archived', updatedAt: now })
        .where(and(eq(programs.ownerId, actor.id), eq(programs.status, 'active')))

      const [created] = await tx
        .insert(programs)
        .values({
          gymId: actor.gymId,
          ownerId: actor.id,
          authorId: actor.id,
          authorKind: 'client_ai',
          name: draft.name,
          status: 'active',
        })
        .returning({ id: programs.id })

      if (!created) throw new Error('Программа не создана')

      for (const [dayIndex, day] of draft.days.entries()) {
        const dayId = randomUUID()

        await tx.insert(programDays).values({
          id: dayId,
          programId: created.id,
          name: day.name,
          order: dayIndex + 1,
        })

        if (day.exercises.length > 0) {
          await tx.insert(programExercises).values(
            day.exercises.map((item, index) => ({
              dayId,
              order: index + 1,
              exerciseId: item.exerciseId,
              sets: item.sets,
              repMin: item.repMin,
              repMax: item.repMax,
              restSec: item.restSec ?? carryRest.get(item.exerciseId) ?? 90,
            })),
          )
        }
      }

      await resolvePlanWeights(created.id, actor.id, { carry: carryWeights }, tx)

      await tx.insert(programChanges).values({
        programId: created.id,
        actorId: actor.id,
        actorKind: 'ai_proposal_accepted',
        diff: draft,
      })
    })
  } catch (error) {
    // Не удалось применить — возвращаем предложение в работу, чтобы клиент мог попробовать снова.
    await db
      .update(aiProposals)
      .set({ status: 'pending', decidedBy: null, decidedAt: null, updatedAt: new Date() })
      .where(and(eq(aiProposals.id, proposalId), eq(aiProposals.status, 'accepted')))
    throw error
  }
}

/** «Не надо»: предложение отклонено, программа не меняется. */
export async function rejectProposal(actor: Actor, proposalId: string): Promise<void> {
  await loadProposal(actor, proposalId)
  await markDecided(actor, proposalId, 'rejected')
}

/** Предложения клиента для карточки в чате. */
export async function listProposals(
  userId: string,
  conversationId?: string,
): Promise<ProposalView[]> {
  const rows = await db
    .select({
      id: aiProposals.id,
      kind: aiProposals.kind,
      status: aiProposals.status,
      diff: aiProposals.diff,
      payload: aiProposals.payload,
      rationale: aiProposals.rationale,
      preview: aiProposals.preview,
      createdAt: aiProposals.createdAt,
    })
    .from(aiProposals)
    .where(
      conversationId
        ? and(eq(aiProposals.userId, userId), eq(aiProposals.conversationId, conversationId))
        : eq(aiProposals.userId, userId),
    )
    .orderBy(desc(aiProposals.createdAt))

  return rows
}
export type ProposalLine = {
  kind: 'added' | 'removed' | 'changed' | 'moved'
  dayName: string
  text: string
}

export type ProposalCard = ProposalView & { lines: ProposalLine[] }

/** Строки «что изменится» для предложения: по дереву программы на момент создания. */
export async function buildProposalLines(
  kind: ProposalKind,
  payloadValue: unknown,
  program: ProgramTree | null,
): Promise<ProposalLine[]> {
  if (kind === 'new_program') {
    const draft = payloadValue as DraftProgramPayload
    const ids = draft.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))
    const names = await exerciseNames(ids)
    const lines: ProposalLine[] = []

    for (const day of draft.days) {
      lines.push({ kind: 'added', dayName: day.name, text: `Добавлен день: ${day.name}` })
      for (const item of day.exercises) {
        lines.push({
          kind: 'added',
          dayName: day.name,
          text: `Добавлено: ${names(item.exerciseId)}, ${item.sets} подхода по ${item.repMin}–${item.repMax} повторений`,
        })
      }
    }

    return lines
  }

  if (!program) return []

  const patch = payloadValue as ProgramPatch
  const published = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.status, 'published'))
  const publishedIds = new Set(published.map((row) => row.id))

  try {
    const after = applyPatch(program, patch, publishedIds)
    const ids = [
      ...program.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
      ...after.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    ]
    return diffPrograms(program, after, await exerciseNames([...new Set(ids)]))
  } catch {
    return []
  }
}

/**
 * Создаёт предложение МаксИИма. Прежние ожидающие предложения клиента становятся «устаревшими»:
 * одновременно жива только одна карточка. Строки «что изменится» сохраняются снимком.
 */
export async function createProposal(input: {
  userId: string
  conversationId: string | null
  kind: ProposalKind
  program: ProgramTree | null
  payload: unknown
  rationale: string | null
}): Promise<string> {
  const lines = await buildProposalLines(input.kind, input.payload, input.program)

  let baseUpdatedAt: Date | null = null
  if (input.program) {
    const [row] = await db
      .select({ updatedAt: programs.updatedAt })
      .from(programs)
      .where(eq(programs.id, input.program.id))
      .limit(1)
    baseUpdatedAt = row?.updatedAt ?? null
  }

  return db.transaction(async (tx) => {
    await tx
      .update(aiProposals)
      .set({ status: 'superseded', updatedAt: new Date() })
      .where(and(eq(aiProposals.userId, input.userId), eq(aiProposals.status, 'pending')))

    const [created] = await tx
      .insert(aiProposals)
      .values({
        userId: input.userId,
        programId: input.program?.id ?? null,
        kind: input.kind,
        diff: input.payload,
        payload: input.payload,
        conversationId: input.conversationId,
        rationale: input.rationale,
        baseProgramUpdatedAt: baseUpdatedAt,
        preview: lines,
      })
      .returning({ id: aiProposals.id })

    return created!.id
  })
}

async function exerciseNames(ids: string[]): Promise<(id: string) => string> {
  if (ids.length === 0) return (id) => id

  const rows = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, ids))

  const map = new Map(rows.map((row) => [row.id, row.name]))
  return (id) => map.get(id) ?? id
}

/** Карточки для экрана чата. Строки берём из снимка; пересчёт — только для старых ожидающих. */
export async function listProposalCards(
  userId: string,
  conversationId?: string,
): Promise<ProposalCard[]> {
  const proposals = await listProposals(userId, conversationId)
  const cards: ProposalCard[] = []

  for (const proposal of proposals) {
    if (Array.isArray(proposal.preview)) {
      cards.push({ ...proposal, lines: proposal.preview as ProposalLine[] })
      continue
    }

    if (proposal.status !== 'pending') {
      cards.push({ ...proposal, lines: [] })
      continue
    }

    const program = proposal.kind === 'patch' ? await findProposalProgram(proposal.id) : null
    const lines = await buildProposalLines(
      proposal.kind,
      proposal.payload ?? proposal.diff,
      program,
    )
    cards.push({ ...proposal, lines })
  }

  return cards
}

async function findProposalProgram(proposalId: string) {
  const [row] = await db
    .select({ programId: aiProposals.programId })
    .from(aiProposals)
    .where(eq(aiProposals.id, proposalId))
    .limit(1)

  return row?.programId ? getProgramTree(row.programId) : null
}
