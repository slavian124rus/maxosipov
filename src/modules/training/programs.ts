import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { exercises } from '@/modules/catalog'
import { notifyThrottled } from '@/modules/notifications'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import {
  applyPatch,
  diffPrograms,
  programPatchSchema,
  type ProgramDiffLine,
  type ProgramPatch,
  type ProgramTree,
} from './patch'
import {
  programChanges,
  programDays,
  programExercises,
  programs,
  type AuthorKind,
} from './schema'

export type ChangeActorKind = 'trainer' | 'client' | 'ai_proposal_accepted'

/** Редактор шлёт патч на каждое действие: клиенту — не чаще одного push в полчаса. */
const PROGRAM_UPDATED_THROTTLE_MS = 30 * 60 * 1000

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

async function publishedExerciseIds(executor: Executor = db): Promise<Set<string>> {
  const rows = await executor
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.status, 'published'), isNull(exercises.archivedAt)))

  return new Set(rows.map((row) => row.id))
}

async function exerciseNames(ids: string[], executor: Executor = db): Promise<(id: string) => string> {
  if (ids.length === 0) return (id) => id

  const rows = await executor
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, ids))

  const map = new Map(rows.map((row) => [row.id, row.name]))
  return (id) => map.get(id) ?? id
}

/** Собирает дерево программы из трёх таблиц. */
export async function getProgramTree(programId: string, executor: Executor = db): Promise<ProgramTree | null> {
  const [program] = await executor.select().from(programs).where(eq(programs.id, programId)).limit(1)
  if (!program) return null

  const days = await executor
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.order))

  const dayIds = days.map((day) => day.id)
  const items = dayIds.length
    ? await executor
        .select()
        .from(programExercises)
        .where(inArray(programExercises.dayId, dayIds))
        .orderBy(asc(programExercises.order))
    : []

  return {
    id: program.id,
    ownerId: program.ownerId,
    authorKind: program.authorKind,
    name: program.name,
    status: program.status,
    days: days.map((day) => ({
      id: day.id,
      order: day.order,
      name: day.name,
      exercises: items
        .filter((item) => item.dayId === day.id)
        .map((item) => ({
          id: item.id,
          order: item.order,
          exerciseId: item.exerciseId,
          sets: item.sets,
          repMin: item.repMin,
          repMax: item.repMax,
          restSec: item.restSec,
          targetWeightKg: item.targetWeightKg,
          note: item.note,
        })),
    })),
  }
}

/** Активная программа клиента. */
export async function getActiveProgram(userId: string): Promise<ProgramTree | null> {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.ownerId, userId), eq(programs.status, 'active')))
    .orderBy(desc(programs.updatedAt))
    .limit(1)

  return program ? getProgramTree(program.id) : null
}

/** Право писать в программу: владелец программы или тренер с `clients.edit_programs`. */
export async function assertProgramWrite(actor: Actor, ownerId: string | null): Promise<void> {
  if (ownerId === null) {
    assertCan(actor, 'clients.edit_programs')
    return
  }

  if (ownerId === actor.id) return

  const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1)
  if (!owner) throw new Error('Клиент не найден')

  assertCan(actor, 'clients.edit_programs', {
    clientId: ownerId,
    clientTrainerId: owner.trainerId,
  })
}

/**
 * Применяет патч к программе в транзакции: строка программы блокируется
 * (`FOR UPDATE`), поэтому параллельные патчи не теряются.
 */
export async function applyProgramPatchAs(
  actor: Actor,
  programId: string,
  patch: ProgramPatch,
  actorKind: ChangeActorKind,
): Promise<ProgramTree> {
  const parsed = programPatchSchema.parse(patch)

  const next = await db.transaction(async (tx) => {
    const [program] = await tx
      .select()
      .from(programs)
      .where(eq(programs.id, programId))
      .for('update')
      .limit(1)

    if (!program) throw new Error('Программа не найдена')
    await assertProgramWrite(actor, program.ownerId)

    const current = await getProgramTree(programId, tx)
    if (!current) throw new Error('Программа не найдена')

    const next = applyPatch(current, parsed, await publishedExerciseIds(tx))

    const afterIds = next.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))
    const beforeIds = current.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))
    const diff = diffPrograms(current, next, await exerciseNames([...afterIds, ...beforeIds], tx))

    const existingDays = await tx
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, programId))
    const existingDayIds = new Set(existingDays.map((day) => day.id))
    const nextDayIds = new Set(next.days.map((day) => day.id))

    for (const day of next.days) {
      if (existingDayIds.has(day.id)) {
        await tx
          .update(programDays)
          .set({ name: day.name, order: day.order, updatedAt: new Date() })
          .where(eq(programDays.id, day.id))
      } else {
        await tx
          .insert(programDays)
          .values({ id: day.id, programId, name: day.name, order: day.order })
      }
    }

    const removedDays = [...existingDayIds].filter((id) => !nextDayIds.has(id))
    if (removedDays.length > 0) {
      await tx.delete(programDays).where(inArray(programDays.id, removedDays))
    }

    const existingItems = nextDayIds.size
      ? await tx
          .select({ id: programExercises.id })
          .from(programExercises)
          .where(inArray(programExercises.dayId, [...nextDayIds]))
      : []
    const existingItemIds = new Set(existingItems.map((item) => item.id))
    const nextItemIds = new Set(next.days.flatMap((day) => day.exercises.map((item) => item.id)))

    for (const day of next.days) {
      for (const item of day.exercises) {
        const values = {
          dayId: day.id,
          order: item.order,
          exerciseId: item.exerciseId,
          sets: item.sets,
          repMin: item.repMin,
          repMax: item.repMax,
          restSec: item.restSec,
          targetWeightKg: item.targetWeightKg,
          note: item.note,
          updatedAt: new Date(),
        }

        if (existingItemIds.has(item.id)) {
          await tx.update(programExercises).set(values).where(eq(programExercises.id, item.id))
        } else {
          await tx.insert(programExercises).values({ id: item.id, ...values })
        }
      }
    }

    const removedItems = [...existingItemIds].filter((id) => !nextItemIds.has(id))
    if (removedItems.length > 0) {
      await tx.delete(programExercises).where(inArray(programExercises.id, removedItems))
    }

    await tx.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, programId))

    await tx.insert(programChanges).values({
      programId,
      actorId: actor.id,
      actorKind,
      diff,
      before: current,
      after: next,
    })

    return next
  })

  // Клиенту — «Максим обновил программу» (push). Ошибка уведомления не отменяет патч.
  if (actorKind === 'trainer' && next.ownerId && next.ownerId !== actor.id) {
    try {
      await notifyThrottled(next.ownerId, 'program_updated', {}, PROGRAM_UPDATED_THROTTLE_MS)
    } catch (error) {
      console.error('[training] не удалось уведомить об обновлении программы', error)
    }
  }

  return next
}

/** Копирует шаблон клиенту: прежняя активная программа уходит в архив. */
export async function copyTemplateToClient(
  actor: Actor,
  templateId: string,
  clientId: string,
  gymId: string,
  /** Внешняя транзакция: так `assignTemplate` выдаёт шаблон нескольким клиентам «всё или ничего». */
  outerTx?: Tx,
): Promise<ProgramTree> {
  if (actor.id !== clientId) {
    const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
    if (!client || client.gymId !== gymId || client.deletedAt !== null) {
      throw new Error('Клиент не найден')
    }
    assertCan(actor, 'clients.edit_programs', {
      clientId,
      clientTrainerId: client.trainerId,
    })
  }

  const template = await getProgramTree(templateId)
  if (!template || template.ownerId !== null) throw new Error('Шаблон не найден')

  const inTransaction = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    outerTx ? fn(outerTx) : db.transaction(fn)

  const runOnce = (): Promise<ProgramTree> =>
    inTransaction(async (tx) => {
    // Сериализуем параллельные копирования для одного клиента (F14):
    // блокировка снимается автоматически в конце транзакции.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clientId}))`)

    await tx
      .update(programs)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(programs.ownerId, clientId), eq(programs.status, 'active')))

    const [created] = await tx
      .insert(programs)
      .values({
        gymId,
        ownerId: clientId,
        authorId: actor.id,
        authorKind: actor.id === clientId ? 'client' : 'trainer',
        name: template.name,
        status: 'active',
        sourceTemplateId: template.id,
      })
      .returning({ id: programs.id })

    if (!created) throw new Error('Программа не создана')

    const days: ProgramTree['days'] = []

    for (const day of template.days) {
      const dayId = randomUUID()

      await tx.insert(programDays).values({
        id: dayId,
        programId: created.id,
        name: day.name,
        order: day.order,
      })

      const items = day.exercises.map((item) => ({
        id: randomUUID(),
        order: item.order,
        exerciseId: item.exerciseId,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        restSec: item.restSec,
        targetWeightKg: item.targetWeightKg,
        note: item.note,
      }))

      if (items.length > 0) {
        await tx
          .insert(programExercises)
          .values(items.map((item) => ({ ...item, dayId })))
      }

      days.push({ id: dayId, order: day.order, name: day.name, exercises: items })
    }

    return {
      id: created.id,
      ownerId: clientId,
      authorKind: actor.id === clientId ? 'client' : 'trainer',
      name: template.name,
      status: 'active',
      days,
    }
  })

  // Параллельный вызов мог создать активную программу между архивацией и вставкой (F14):
  // уникальный индекс отклонит вторую — повторяем транзакцию один раз.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await runOnce()
    } catch (error) {
      if (!outerTx && attempt === 0 && isUniqueViolation(error)) continue
      throw error
    }
  }

  throw new Error('Не удалось создать программу')
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

/** История изменений программы: кто, когда и что поменял (новые сверху). */
export type ProgramChangeView = {
  id: string
  actorId: string | null
  actorKind: ChangeActorKind
  diff: ProgramDiffLine[]
  createdAt: Date
}

export async function listProgramChanges(programId: string, limit = 30): Promise<ProgramChangeView[]> {
  const rows = await db
    .select()
    .from(programChanges)
    .where(eq(programChanges.programId, programId))
    .orderBy(desc(programChanges.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    diff: (row.diff as ProgramDiffLine[] | null) ?? [],
    createdAt: row.createdAt,
  }))
}

/** Авторство программ по id — тренеру нужно знать, чью программу менял МаксИИм. */
export async function getProgramAuthorKinds(
  programIds: string[],
): Promise<Map<string, AuthorKind>> {
  if (programIds.length === 0) return new Map()

  const rows = await db
    .select({ id: programs.id, authorKind: programs.authorKind })
    .from(programs)
    .where(inArray(programs.id, programIds))

  return new Map(rows.map((row) => [row.id, row.authorKind]))
}

export async function createTemplate(actor: Actor, name: string, gymId: string): Promise<string> {
  assertCan(actor, 'clients.edit_programs')

  const [row] = await db
    .insert(programs)
    .values({ gymId, ownerId: null, authorId: actor.id, authorKind: 'trainer', name })
    .returning({ id: programs.id })

  if (!row) throw new Error('Шаблон не создан')
  return row.id
}

export async function listTemplates(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(and(isNull(programs.ownerId), eq(programs.status, 'active')))
    .orderBy(asc(programs.name))
}

export async function archiveProgram(actor: Actor, programId: string): Promise<void> {
  const [program] = await db.select().from(programs).where(eq(programs.id, programId)).limit(1)
  if (!program) throw new Error('Программа не найдена')

  await assertProgramWrite(actor, program.ownerId)

  await db
    .update(programs)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(programs.id, programId))
}