import { and, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { exercises } from '@/modules/catalog'
import type { Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { diffPrograms, type ProgramTree } from './patch'
import {
  assertProgramWrite,
  copyTemplateToClient,
  getProgramTree,
  isUniqueViolation,
} from './programs'
import { aiProposals, programChanges, programDays, programExercises, programs } from './schema'
import { allocateTemplateNumber } from './templates'

/** Ошибка отката: программа уже ушла дальше, автоматически вернуть нельзя. */
export const REVERT_CONFLICT = 'После этого программу уже меняли — поправь вручную'

async function namesFor(ids: string[]): Promise<(id: string) => string> {
  if (ids.length === 0) return (id) => id

  const rows = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, ids))

  const map = new Map(rows.map((row) => [row.id, row.name]))
  return (id) => map.get(id) ?? id
}

/**
 * Откат изменения: разрешён только для последнего изменения программы.
 * Восстанавливает снимок `before` новым изменением с `actor_kind='trainer'`
 * и помечает связанное предложение МаксИИма как `reverted`.
 */
export async function revertChange(actor: Actor, changeId: string): Promise<ProgramTree> {
  return db.transaction(async (tx) => {
    const [change] = await tx
      .select()
      .from(programChanges)
      .where(eq(programChanges.id, changeId))
      .for('update')
      .limit(1)

    if (!change) throw new Error('Изменение не найдено')

    const [program] = await tx
      .select()
      .from(programs)
      .where(eq(programs.id, change.programId))
      .for('update')
      .limit(1)

    if (!program) throw new Error('Программа не найдена')
    await assertProgramWrite(actor, program.ownerId)

    const [latest] = await tx
      .select({ id: programChanges.id })
      .from(programChanges)
      .where(eq(programChanges.programId, change.programId))
      .orderBy(desc(programChanges.createdAt))
      .limit(1)

    if (latest?.id !== changeId) throw new Error(REVERT_CONFLICT)
    if (!change.before) throw new Error('У этого изменения нет снимка — поправь вручную')

    const before = change.before as ProgramTree
    const current = await getProgramTree(change.programId, tx)
    if (!current) throw new Error('Программа не найдена')

    const ids = [
      ...current.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
      ...before.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    ]
    const names = await namesFor([...new Set(ids)])
    const diff = diffPrograms(current, before, names)

    // Полная замена дерева снимком: идентификаторы дней и упражнений сохраняются.
    await tx.delete(programDays).where(eq(programDays.programId, change.programId))

    for (const day of before.days) {
      await tx.insert(programDays).values({
        id: day.id,
        programId: change.programId,
        name: day.name,
        order: day.order,
      })

      if (day.exercises.length > 0) {
        await tx.insert(programExercises).values(
          day.exercises.map((item) => ({
            id: item.id,
            dayId: day.id,
            order: item.order,
            exerciseId: item.exerciseId,
            sets: item.sets,
            repMin: item.repMin,
            repMax: item.repMax,
            restSec: item.restSec,
            targetWeightKg: item.targetWeightKg,
            setWeights: item.setWeights ?? null,
            note: item.note,
          })),
        )
      }
    }

    const now = new Date()
    await tx.update(programs).set({ updatedAt: now }).where(eq(programs.id, change.programId))

    await tx.insert(programChanges).values({
      programId: change.programId,
      actorId: actor.id,
      actorKind: 'trainer',
      diff,
      before: current,
      after: before,
    })

    // Предложением МаксИИма считается только то, что породило откатываемое изменение:
    // последнее принятое по этой программе. Откат правки Максима предложения не трогает.
    if (change.actorKind === 'ai_proposal_accepted') {
      const [proposal] = await tx
        .select({ id: aiProposals.id })
        .from(aiProposals)
        .where(and(eq(aiProposals.programId, change.programId), eq(aiProposals.status, 'accepted')))
        .orderBy(desc(aiProposals.updatedAt))
        .limit(1)

      if (proposal) {
        await tx
          .update(aiProposals)
          .set({ status: 'reverted', updatedAt: now })
          .where(eq(aiProposals.id, proposal.id))
      }
    }

    return before
  })
}

/**
 * Назначает шаблон нескольким клиентам: каждому — своя активная копия.
 * Одна транзакция на всех: если хоть у одного клиента нет прав или копия не создалась,
 * не получает шаблон никто. Клиенты идут в порядке id — параллельные вызовы не блокируют друг друга.
 */
export async function assignTemplate(
  actor: Actor,
  templateId: string,
  clientIds: string[],
): Promise<void> {
  const unique = [...new Set(clientIds)].sort()
  if (unique.length === 0) throw new Error('Выбери хотя бы одного клиента')

  // Параллельное копирование тому же клиенту может отклонить уникальный индекс «одна активная
  // программа» (F14): транзакция откатывается целиком, повторяем один раз.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await db.transaction(async (tx) => {
        for (const clientId of unique) {
          await copyTemplateToClient(actor, templateId, clientId, actor.gymId, tx)
        }
      })
      return
    } catch (error) {
      if (attempt === 0 && isUniqueViolation(error)) continue
      throw error
    }
  }
}

/** Сохраняет программу клиента как шаблон зала (копия дерева). */
export async function saveAsTemplate(
  actor: Actor,
  programId: string,
  name: string,
): Promise<string> {
  const tree = await getProgramTree(programId)
  if (!tree) throw new Error('Программа не найдена')

  await assertProgramWrite(actor, tree.ownerId)

  const title = name.trim()
  if (title.length < 2 || title.length > 80) throw new Error('Название шаблона — от 2 до 80 символов')

  return db.transaction(async (tx) => {
    const number = await allocateTemplateNumber(actor.gymId)

    const [created] = await tx
      .insert(programs)
      .values({
        gymId: actor.gymId,
        ownerId: null,
        authorId: actor.id,
        authorKind: 'trainer',
        name: title,
        templateNumber: number,
      })
      .returning({ id: programs.id })

    if (!created) throw new Error('Шаблон не создан')

    for (const day of tree.days) {
      const dayId = randomUUID()

      await tx.insert(programDays).values({
        id: dayId,
        programId: created.id,
        name: day.name,
        order: day.order,
      })

      if (day.exercises.length > 0) {
        await tx.insert(programExercises).values(
          day.exercises.map((item) => ({
            dayId,
            order: item.order,
            exerciseId: item.exerciseId,
            sets: item.sets,
            repMin: item.repMin,
            repMax: item.repMax,
            restSec: item.restSec,
            targetWeightKg: item.targetWeightKg,
            setWeights: item.setWeights ?? null,
            note: item.note,
          })),
        )
      }
    }

    return created.id
  })
}