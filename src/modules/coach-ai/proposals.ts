import { and, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { exercises } from '@/modules/catalog'
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
  type ProgramPatch,
  type ProposalKind,
  type ProposalStatus,
} from '@/modules/training'

export type DraftProgramPayload = {
  name: string
  days: {
    name: string
    exercises: { exerciseId: string; sets: number; repMin: number; repMax: number }[]
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
  createdAt: Date
}

const ALREADY_DECIDED = 'Уже решено'

async function loadProposal(actor: Actor, proposalId: string) {
  const [proposal] = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId)).limit(1)

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

/** Принятие предложения: патч применяется к программе, новая программа становится активной. */
export async function acceptProposal(actor: Actor, proposalId: string): Promise<void> {
  const proposal = await loadProposal(actor, proposalId)

  // Статус ставим первым: параллельное повторное нажатие увидит «Уже решено»
  // и не применит изменение дважды.
  await markDecided(actor, proposalId, 'accepted')

  try {
    if (proposal.kind === 'patch') {
      if (!proposal.programId) throw new Error('Программа не найдена')
      await applyProgramPatchAs(
        actor,
        proposal.programId,
        (proposal.payload ?? proposal.diff) as ProgramPatch,
        'ai_proposal_accepted',
      )
      return
    }

    const draft = (proposal.payload ?? proposal.diff) as DraftProgramPayload

    await db.transaction(async (tx) => {
      const now = new Date()

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
              restSec: 90,
            })),
          )
        }
      }

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

async function exerciseNames(ids: string[]): Promise<(id: string) => string> {
  if (ids.length === 0) return (id) => id

  const rows = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, ids))

  const map = new Map(rows.map((row) => [row.id, row.name]))
  return (id) => map.get(id) ?? id
}

/** Карточки для экрана чата: строки «что изменится» уже в человеческом виде. */
export async function listProposalCards(
  userId: string,
  conversationId?: string,
): Promise<ProposalCard[]> {
  const proposals = await listProposals(userId, conversationId)
  const cards: ProposalCard[] = []

  for (const proposal of proposals) {
    if (proposal.kind === 'new_program') {
      const draft = (proposal.payload ?? proposal.diff) as DraftProgramPayload
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

      cards.push({ ...proposal, lines })
      continue
    }

    const program = await findProposalProgram(proposal.id)
    if (!program) {
      cards.push({ ...proposal, lines: [] })
      continue
    }

    const patch = (proposal.payload ?? proposal.diff) as ProgramPatch
    const published = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.status, 'published'))
    const publishedIds = new Set(published.map((row) => row.id))

    let lines: ProposalLine[] = []
    try {
      const after = applyPatch(program, patch, publishedIds)
      const ids = [
        ...program.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
        ...after.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
      ]
      lines = diffPrograms(program, after, await exerciseNames([...new Set(ids)]))
    } catch {
      lines = []
    }

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