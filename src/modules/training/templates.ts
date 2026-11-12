import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { exercises } from '@/modules/catalog'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { templateMeta, templateTitle, type TemplateListItem as TemplateListItemType } from '@/shared/program-labels'
import { assertProgramWrite, getProgramTree, isUniqueViolation } from './programs'
import {
  programChanges,
  programDays,
  programExercises,
  programs,
  type ProgramAudience,
  type ProgramGoal,
} from './schema'
import type { ProgramDiffLine } from './patch'

export { AUDIENCE_LABELS, GOAL_LABELS, templateMeta, templateTitle } from '@/shared/program-labels'
export type { ProgramAudience, ProgramGoal } from '@/shared/program-labels'

export type TemplateListItem = TemplateListItemType

/**
 * Шаблоны зала с числом дней и упражнений — для экрана «Программы».
 * Счётчики считаем одним запросом, чтобы не ходить в БД на каждую карточку.
 */
export async function listTemplateItems(): Promise<TemplateListItem[]> {
  const rows = await db
    .select({
      id: programs.id,
      name: programs.name,
      audience: programs.audience,
      goal: programs.goal,
      number: programs.templateNumber,
      updatedAt: programs.updatedAt,
      days: sql<number>`count(distinct ${programDays.id})::int`,
      exercises: sql<number>`count(${programExercises.id})::int`,
    })
    .from(programs)
    .leftJoin(programDays, eq(programDays.programId, programs.id))
    .leftJoin(programExercises, eq(programExercises.dayId, programDays.id))
    .where(and(isNull(programs.ownerId), eq(programs.status, 'active')))
    .groupBy(programs.id)
    .orderBy(asc(programs.templateNumber), asc(programs.name))

  return rows.map((row) => ({
    ...row,
    title: templateTitle(row),
    subtitle: templateMeta(row),
  }))
}

/** Шаблоны для выбора клиентом: id и готовое название («Похудение для женщин №3»). */
export async function listTemplates(): Promise<{ id: string; name: string }[]> {
  return (await listTemplateItems()).map((item) => ({ id: item.id, name: item.title }))
}

/** Следующий номер шаблона в зале. */
export async function allocateTemplateNumber(gymId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${programs.templateNumber}), 0)::int` })
    .from(programs)
    .where(and(eq(programs.gymId, gymId), isNull(programs.ownerId)))

  return (row?.max ?? 0) + 1
}

export type CreateTemplateInput = {
  name: string
  audience?: ProgramAudience | null
  goal?: ProgramGoal | null
  /** Сколько пустых дней создать сразу (0 — шаблон без дней). */
  days?: number
}

/**
 * Новый шаблон: имя, для кого, цель и номер в зале. Номер выдаём сами —
 * параллельное создание ловим по уникальному индексу и пробуем ещё раз.
 */
export async function createTemplate(actor: Actor, input: CreateTemplateInput): Promise<string> {
  assertCan(actor, 'clients.edit_programs')

  const name = input.name.trim()
  if (name.length < 2) throw new Error('Название шаблона — от 2 символов')
  if (name.length > 80) throw new Error('Название шаблона — до 80 символов')

  const days = Math.min(Math.max(Math.trunc(input.days ?? 0), 0), 7)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await allocateTemplateNumber(actor.gymId)

    try {
      return await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(programs)
          .values({
            gymId: actor.gymId,
            ownerId: null,
            authorId: actor.id,
            authorKind: 'trainer',
            name,
            audience: input.audience ?? null,
            goal: input.goal ?? null,
            templateNumber: number,
          })
          .returning({ id: programs.id })

        if (!created) throw new Error('Шаблон не создан')

        for (let index = 0; index < days; index += 1) {
          await tx.insert(programDays).values({
            programId: created.id,
            order: index + 1,
            name: `День ${index + 1}`,
          })
        }

        return created.id
      })
    } catch (error) {
      // Номер заняли параллельно — берём следующий.
      if (isUniqueViolation(error) && attempt < 4) continue
      throw error
    }
  }

  throw new Error('Не удалось создать шаблон')
}

/** Удаление шаблона: уходит в архив, история и выданные копии остаются (CLAUDE.md, правило 6). */
export async function archiveTemplate(actor: Actor, templateId: string): Promise<void> {
  const [program] = await db.select().from(programs).where(eq(programs.id, templateId)).limit(1)
  if (!program) throw new Error('Шаблон не найден')
  if (program.ownerId !== null) throw new Error('Это программа клиента, а не шаблон')

  await assertProgramWrite(actor, program.ownerId)

  await db
    .update(programs)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(programs.id, templateId))
}


/** Метаданные шаблона: имя, для кого, цель. */
export async function updateTemplateMeta(
  actor: Actor,
  templateId: string,
  input: { name?: string; audience?: ProgramAudience | null; goal?: ProgramGoal | null },
): Promise<void> {
  const [program] = await db.select().from(programs).where(eq(programs.id, templateId)).limit(1)
  if (!program) throw new Error('Шаблон не найден')
  if (program.ownerId !== null) throw new Error('Это программа клиента, а не шаблон')

  await assertProgramWrite(actor, program.ownerId)

  const name = input.name?.trim()
  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    throw new Error('Название шаблона — от 2 до 80 символов')
  }

  await db
    .update(programs)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      updatedAt: new Date(),
    })
    .where(eq(programs.id, templateId))
}

export type TemplateDayInput = {
  name: string
  exercises: {
    exerciseId: string
    sets: number
    repMin: number
    repMax: number
    restSec?: number
    note?: string | null
  }[]
}

/**
 * Заменяет дни шаблона целиком — этим пользуется МаксИИм, когда собирает программу.
 * Пишем в одной транзакции: либо все дни новые, либо шаблон остался прежним.
 */
export async function replaceTemplateDays(
  actor: Actor,
  templateId: string,
  days: TemplateDayInput[],
): Promise<void> {
  const [program] = await db.select().from(programs).where(eq(programs.id, templateId)).limit(1)
  if (!program) throw new Error('Шаблон не найден')
  if (program.ownerId !== null) throw new Error('Дни меняем только у шаблона')

  await assertProgramWrite(actor, program.ownerId)

  if (days.length === 0) throw new Error('В шаблоне должен быть хотя бы один день')
  if (days.length > 7) throw new Error('В шаблоне — не больше 7 дней')

  const published = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.status, 'published'), isNull(exercises.archivedAt)))
  const publishedIds = new Set(published.map((row) => row.id))

  const diff: ProgramDiffLine[] = []

  for (const [dayIndex, day] of days.entries()) {
    if (day.exercises.length === 0) throw new Error(`В дне «${day.name}» нет упражнений`)
    if (day.exercises.length > 12) throw new Error(`В дне «${day.name}» больше 12 упражнений`)

    for (const item of day.exercises) {
      if (!publishedIds.has(item.exerciseId)) {
        throw new Error(`В дне «${day.name}» есть упражнение не из каталога`)
      }
    }

    diff.push({
      kind: 'changed',
      dayName: day.name,
      text: `${dayIndex + 1}. ${day.name}: ${day.exercises.length} упражнений`,
    })
  }

  await db.transaction(async (tx) => {
    const before = await getProgramTree(templateId, tx)

    await tx.delete(programDays).where(eq(programDays.programId, templateId))

    for (const [dayIndex, day] of days.entries()) {
      const dayId = randomUUID()

      await tx.insert(programDays).values({
        id: dayId,
        programId: templateId,
        order: dayIndex + 1,
        name: day.name.slice(0, 80),
      })

      await tx.insert(programExercises).values(
        day.exercises.map((item, index) => ({
          dayId,
          order: index + 1,
          exerciseId: item.exerciseId,
          sets: Math.min(Math.max(Math.trunc(item.sets), 1), 10),
          repMin: Math.min(Math.max(Math.trunc(item.repMin), 1), 50),
          repMax: Math.min(Math.max(Math.trunc(item.repMax), 1), 50),
          restSec: Math.min(Math.max(Math.trunc(item.restSec ?? 90), 0), 600),
          note: item.note?.trim() ? item.note.trim().slice(0, 200) : null,
        })),
      )
    }

    await tx.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, templateId))

    await tx.insert(programChanges).values({
      programId: templateId,
      actorId: actor.id,
      actorKind: 'trainer',
      diff,
      before: before ?? null,
      after: null,
    })
  })
}
