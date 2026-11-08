import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { exercises } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import { recommend, recommendationText, type Recommendation } from '@/modules/progression'
import { ForbiddenError } from '@/modules/rbac'
import { db } from '@/shared/db'
import { enqueueJob } from '@/shared/queue'
import { nextWeights, setLogs, workoutSessions } from './schema'

export type SyncSetItem = {
  clientUuid: string
  sessionClientUuid: string
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  feeling?: 'easy' | 'good' | 'hard'
  startedAt?: Date
  finishedAt?: Date
  loggedOffline: boolean
}

async function findSessionByClientUuid(clientUuid: string) {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.clientUuid, clientUuid))
    .limit(1)
  return session ?? null
}

/** Старт тренировки идемпотентен по `clientUuid`: повторный вызов вернёт ту же сессию. */
export async function startSession(
  userId: string,
  input: {
    programDayId: string | null
    mode: 'free' | 'guided'
    clientUuid: string
    startedAt: Date
  },
): Promise<{ sessionId: string }> {
  const existing = await findSessionByClientUuid(input.clientUuid)
  if (existing) {
    if (existing.userId !== userId) throw new ForbiddenError('Это чужая тренировка')
    return { sessionId: existing.id }
  }

  const [created] = await db
    .insert(workoutSessions)
    .values({
      userId,
      programDayId: input.programDayId,
      mode: input.mode,
      clientUuid: input.clientUuid,
      startedAt: input.startedAt,
    })
    .returning({ id: workoutSessions.id })

  if (!created) throw new Error('Тренировка не создана')
  return { sessionId: created.id }
}

/** Идемпотентная запись подходов: upsert по `client_uuid`, чужая сессия — ошибка. */
export async function syncSets(
  userId: string,
  items: SyncSetItem[],
): Promise<{ accepted: string[] }> {
  const accepted: string[] = []

  for (const item of items) {
    const session = await findSessionByClientUuid(item.sessionClientUuid)
    if (!session) throw new Error('Тренировка не найдена')
    if (session.userId !== userId) throw new ForbiddenError('Это чужая тренировка')

    await db
      .insert(setLogs)
      .values({
        sessionId: session.id,
        exerciseId: item.exerciseId,
        setIndex: item.setIndex,
        weightKg: item.weightKg,
        reps: item.reps,
        feeling: item.feeling ?? null,
        startedAt: item.startedAt ?? null,
        finishedAt: item.finishedAt ?? null,
        loggedOffline: item.loggedOffline ? 1 : 0,
        clientUuid: item.clientUuid,
      })
      .onConflictDoUpdate({
        target: setLogs.clientUuid,
        set: {
          weightKg: item.weightKg,
          reps: item.reps,
          setIndex: item.setIndex,
          feeling: item.feeling ?? null,
          loggedOffline: item.loggedOffline ? 1 : 0,
          updatedAt: new Date(),
        },
      })

    accepted.push(item.clientUuid)
  }

  return { accepted }
}

/** Ощущение ставится всем подходам упражнения в этой тренировке. */
export async function setExerciseFeeling(
  userId: string,
  sessionClientUuid: string,
  exerciseId: string,
  feeling: 'easy' | 'good' | 'hard',
): Promise<void> {
  const session = await findSessionByClientUuid(sessionClientUuid)
  if (!session) throw new Error('Тренировка не найдена')
  if (session.userId !== userId) throw new ForbiddenError('Это чужая тренировка')

  await db
    .update(setLogs)
    .set({ feeling, updatedAt: new Date() })
    .where(and(eq(setLogs.sessionId, session.id), eq(setLogs.exerciseId, exerciseId)))
}

/** Завершение тренировки: фиксирует время, комментарий и ставит задачу итога. */
export async function finishSession(
  userId: string,
  sessionClientUuid: string,
  input: { finishedAt: Date; comment?: string },
  deps: { enqueue?: (name: string, data: object) => Promise<void> } = {},
): Promise<void> {
  const session = await findSessionByClientUuid(sessionClientUuid)
  if (!session) throw new Error('Тренировка не найдена')
  if (session.userId !== userId) throw new ForbiddenError('Это чужая тренировка')

  await db
    .update(workoutSessions)
    .set({
      finishedAt: input.finishedAt,
      comment: input.comment ?? session.comment,
      updatedAt: new Date(),
    })
    .where(eq(workoutSessions.id, session.id))

  // Обработчик появится на этапе 4 (итог МаксИИма), сейчас задача просто в очереди.
  await (deps.enqueue ?? enqueueJob)('session.summary', { sessionId: session.id })
}

/** Рекомендованный вес «на следующий раз». */
export async function setNextWeight(
  userId: string,
  exerciseId: string,
  weightKg: number,
): Promise<void> {
  await db
    .insert(nextWeights)
    .values({ userId, exerciseId, weightKg, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [nextWeights.userId, nextWeights.exerciseId],
      set: { weightKg, updatedAt: new Date() },
    })
}

export async function getNextWeight(userId: string, exerciseId: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(nextWeights)
    .where(and(eq(nextWeights.userId, userId), eq(nextWeights.exerciseId, exerciseId)))
    .limit(1)

  return row?.weightKg ?? null
}

export type HistorySession = {
  date: Date
  sets: { weightKg: number; reps: number; feeling: 'easy' | 'good' | 'hard' | null }[]
}

/** История подходов упражнения: новые тренировки первыми. */
export async function getHistoryForExercise(
  userId: string,
  exerciseId: string,
  limit = 6,
): Promise<HistorySession[]> {
  const rows = await db
    .select({
      sessionId: setLogs.sessionId,
      startedAt: workoutSessions.startedAt,
      weightKg: setLogs.weightKg,
      reps: setLogs.reps,
      feeling: setLogs.feeling,
      setIndex: setLogs.setIndex,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(and(eq(workoutSessions.userId, userId), eq(setLogs.exerciseId, exerciseId)))
    .orderBy(desc(workoutSessions.startedAt), asc(setLogs.setIndex))

  const bySession = new Map<string, HistorySession>()

  for (const row of rows) {
    const entry = bySession.get(row.sessionId) ?? { date: row.startedAt, sets: [] }
    entry.sets.push({ weightKg: row.weightKg, reps: row.reps, feeling: row.feeling })
    bySession.set(row.sessionId, entry)
  }

  return [...bySession.values()].slice(0, limit)
}

export type DayRecommendation = Recommendation & { text: string }

/** Рекомендации по всем упражнениям дня программы. */
export async function getRecommendations(
  userId: string,
  programDayId: string,
): Promise<Record<string, DayRecommendation>> {
  const gym = await getGym()

  const rows = await db.execute<{
    exercise_id: string
    sets: number
    rep_min: number
    rep_max: number
    step_kg: number
  }>(sql`
    select pe.exercise_id, pe.sets, pe.rep_min, pe.rep_max,
           coalesce(m.weight_step_kg, 2.5) as step_kg
    from program_exercises pe
    join program_days pd on pd.id = pe.day_id
    left join exercises e on e.id = pe.exercise_id
    left join machines m on m.id = e.machine_id
    where pd.id = ${programDayId}
    order by pe."order"
  `)

  const result: Record<string, DayRecommendation> = {}

  for (const row of rows) {
    const history = await getHistoryForExercise(userId, row.exercise_id)
    const recommendation = recommend(
      {
        target: { sets: row.sets, repMin: row.rep_min, repMax: row.rep_max },
        stepKg: Number(row.step_kg),
        history,
      },
      gym.settings.progressionRules,
    )

    result[row.exercise_id] = {
      ...recommendation,
      text: recommendationText(recommendation, { repMax: row.rep_max }),
    }
  }

  return result
}

export type SessionSummary = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  mode: 'free' | 'guided'
  volumeKg: number
  exerciseCount: number
}

/** Сводка тренировки: объём (вес×повторения) и число упражнений. */
export async function getSessionSummary(
  userId: string,
  sessionId: string,
): Promise<SessionSummary | null> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1)

  if (!session || session.userId !== userId) return null

  const rows = await db.select().from(setLogs).where(eq(setLogs.sessionId, sessionId))

  return {
    id: session.id,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    mode: session.mode,
    volumeKg: Math.round(rows.reduce((sum, row) => sum + row.weightKg * row.reps, 0)),
    exerciseCount: new Set(rows.map((row) => row.exerciseId)).size,
  }
}

export type SessionDetail = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  mode: 'free' | 'guided'
  exercises: {
    exerciseId: string
    name: string
    sets: { setIndex: number; weightKg: number; reps: number; feeling: string | null }[]
  }[]
}

/** Карточка тренировки из истории: упражнения, подходы, ощущения. */
export async function getSessionDetail(
  userId: string,
  sessionId: string,
): Promise<SessionDetail | null> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1)

  if (!session || session.userId !== userId) return null

  const rows = await db
    .select({
      exerciseId: setLogs.exerciseId,
      setIndex: setLogs.setIndex,
      weightKg: setLogs.weightKg,
      reps: setLogs.reps,
      feeling: setLogs.feeling,
      name: exercises.name,
    })
    .from(setLogs)
    .leftJoin(exercises, eq(exercises.id, setLogs.exerciseId))
    .where(eq(setLogs.sessionId, sessionId))
    .orderBy(asc(setLogs.exerciseId), asc(setLogs.setIndex))

  const grouped = new Map<string, SessionDetail['exercises'][number]>()

  for (const row of rows) {
    const entry = grouped.get(row.exerciseId) ?? {
      exerciseId: row.exerciseId,
      name: row.name ?? 'Упражнение',
      sets: [],
    }
    entry.sets.push({
      setIndex: row.setIndex,
      weightKg: row.weightKg,
      reps: row.reps,
      feeling: row.feeling,
    })
    grouped.set(row.exerciseId, entry)
  }

  return {
    id: session.id,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    mode: session.mode,
    exercises: [...grouped.values()],
  }
}

/** История тренировок клиента (только завершённые). */
export async function listSessions(
  userId: string,
  limit = 30,
): Promise<{ id: string; startedAt: Date; finishedAt: Date | null; mode: string }[]> {
  return db
    .select({
      id: workoutSessions.id,
      startedAt: workoutSessions.startedAt,
      finishedAt: workoutSessions.finishedAt,
      mode: workoutSessions.mode,
    })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), sql`${workoutSessions.finishedAt} is not null`))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit)
}