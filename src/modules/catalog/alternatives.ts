import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { assertCan, type Actor } from '@/modules/rbac'
import { isMuscleCode } from './muscles'
import { exerciseAlternatives, exercises, machines } from './schema'

export type AlternativeItem = {
  id: string
  slug: string
  name: string
  machineId: string | null
  machineName: string | null
}

const columns = {
  id: exercises.id,
  slug: exercises.slug,
  name: exercises.name,
  machineId: exercises.machineId,
  machineName: machines.name,
}

/** Альтернативы, которые видит клиент: только опубликованные и не в архиве, в порядке тренера. */
export async function listAlternatives(exerciseId: string): Promise<AlternativeItem[]> {
  return db
    .select(columns)
    .from(exerciseAlternatives)
    .innerJoin(exercises, eq(exercises.id, exerciseAlternatives.alternativeId))
    .leftJoin(machines, eq(machines.id, exercises.machineId))
    .where(
      and(
        eq(exerciseAlternatives.exerciseId, exerciseId),
        eq(exercises.status, 'published'),
        isNull(exercises.archivedAt),
      ),
    )
    .orderBy(asc(exerciseAlternatives.sortOrder), asc(exercises.name))
}

/**
 * Подсказка тренеру: опубликованные упражнения с теми же основными мышцами на других
 * тренажёрах. Чем больше общих мышц, тем выше.
 */
export async function suggestAlternatives(exerciseId: string, limit = 5): Promise<AlternativeItem[]> {
  const [source] = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1)
  // Коды мышц попадают в SQL текстом, поэтому пропускаем только известные.
  const sourceMuscles = source?.primaryMuscles.filter(isMuscleCode) ?? []
  if (!source || sourceMuscles.length === 0) return []

  const chosen = db
    .select({ id: exerciseAlternatives.alternativeId })
    .from(exerciseAlternatives)
    .where(eq(exerciseAlternatives.exerciseId, exerciseId))

  const shared = sql<number>`(
    select count(*) from unnest(${exercises.primaryMuscles}) as m
    where m = any(${sql.raw(`array[${sourceMuscles.map((m) => `'${m}'`).join(',')}]::text[]`)})
  )`

  const conditions = [
    ne(exercises.id, exerciseId),
    eq(exercises.status, 'published'),
    isNull(exercises.archivedAt),
    sql`${exercises.id} not in (${chosen})`,
    sql`${shared} > 0`,
  ]
  if (source.machineId) {
    conditions.push(sql`(${exercises.machineId} is null or ${exercises.machineId} <> ${source.machineId})`)
  }

  return db
    .select(columns)
    .from(exercises)
    .leftJoin(machines, eq(machines.id, exercises.machineId))
    .where(and(...conditions))
    .orderBy(sql`${shared} desc`, asc(exercises.name))
    .limit(limit)
}

/**
 * Заменяет список альтернатив упражнения. С `mirror` связь добавляется и в обратную
 * сторону (в конец списка второго упражнения), без дублей.
 */
export async function setAlternatives(
  actor: Actor,
  exerciseId: string,
  alternativeIds: string[],
  options: { mirror?: boolean } = {},
): Promise<void> {
  assertCan(actor, 'catalog.edit')

  const unique = [...new Set(alternativeIds)]
  if (unique.includes(exerciseId)) throw new Error('Упражнение не может быть альтернативой само себе')

  const found = unique.length
    ? await db.select({ id: exercises.id }).from(exercises).where(inArray(exercises.id, unique))
    : []
  if (found.length !== unique.length) throw new Error('Альтернатива не найдена')

  await db.transaction(async (tx) => {
    await tx.delete(exerciseAlternatives).where(eq(exerciseAlternatives.exerciseId, exerciseId))
    if (unique.length) {
      await tx
        .insert(exerciseAlternatives)
        .values(unique.map((alternativeId, index) => ({ exerciseId, alternativeId, sortOrder: index })))
    }

    if (!options.mirror) return
    for (const alternativeId of unique) {
      const [last] = await tx
        .select({ max: sql<number>`coalesce(max(${exerciseAlternatives.sortOrder}), -1)` })
        .from(exerciseAlternatives)
        .where(eq(exerciseAlternatives.exerciseId, alternativeId))
      await tx
        .insert(exerciseAlternatives)
        .values({ exerciseId: alternativeId, alternativeId: exerciseId, sortOrder: (last?.max ?? -1) + 1 })
        .onConflictDoNothing()
    }
  })
}
