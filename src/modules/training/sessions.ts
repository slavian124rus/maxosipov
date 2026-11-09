import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { exercises } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import { recommend, recommendationText, type Recommendation } from '@/modules/progression'
import { ForbiddenError } from '@/modules/rbac'
import { db } from '@/shared/db'
import { dayKey, mondayKey } from '@/shared/dates'
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
    .onConflictDoNothing({ target: workoutSessions.clientUuid })
    .returning({ id: workoutSessions.id })

  if (created) return { sessionId: created.id }

  // параллельный повторный старт: сессию уже создал соседний запрос
  const raced = await findSessionByClientUuid(input.clientUuid)
  if (!raced) throw new Error('Тренировка не создана')
  if (raced.userId !== userId) throw new ForbiddenError('Это чужая тренировка')
  return { sessionId: raced.id }
}

function isValidSetItem(item: SyncSetItem): boolean {
  return (
    item.clientUuid.length > 0 &&
    item.clientUuid.length <= 64 &&
    Number.isInteger(item.setIndex) &&
    item.setIndex >= 1 &&
    item.setIndex <= 100 &&
    Number.isFinite(item.weightKg) &&
    item.weightKg >= 0 &&
    item.weightKg <= 1000 &&
    Number.isInteger(item.reps) &&
    item.reps >= 1 &&
    item.reps <= 200 &&
    (item.feeling === undefined || ['easy', 'good', 'hard'].includes(item.feeling)) &&
    (item.startedAt === undefined || !Number.isNaN(item.startedAt.getTime())) &&
    (item.finishedAt === undefined || !Number.isNaN(item.finishedAt.getTime()))
  )
}

/**
 * Идемпотентная запись подходов: upsert по `client_uuid`.
 * - `accepted` — записаны (в том числе повторно);
 * - `rejected` — навсегда непригодны (кривые числа, нет такого упражнения, `client_uuid` уже занят
 *   чужим подходом): клиент больше их не шлёт, очередь не блокируется;
 * - всё остальное (например, сессия ещё не создана) клиент отправит повторно.
 * Чужая сессия — `ForbiddenError`.
 */
export async function syncSets(
  userId: string,
  items: SyncSetItem[],
): Promise<{ accepted: string[]; rejected: string[] }> {
  const accepted: string[] = []
  const rejected: string[] = []

  const exerciseIds = [...new Set(items.map((item) => item.exerciseId))].filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  )
  const known = new Set(
    exerciseIds.length
      ? (
          await db.select({ id: exercises.id }).from(exercises).where(inArray(exercises.id, exerciseIds))
        ).map((row) => row.id)
      : [],
  )

  for (const item of items) {
    if (!isValidSetItem(item) || !known.has(item.exerciseId)) {
      rejected.push(item.clientUuid)
      continue
    }

    const session = await findSessionByClientUuid(item.sessionClientUuid)
    if (!session) continue // старт ещё не дошёл — повторим позже
    if (session.userId !== userId) throw new ForbiddenError('Это чужая тренировка')

    const written = await db
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
        // чужой `client_uuid` не перезаписываем: обновляем только подход этой же сессии
        setWhere: eq(setLogs.sessionId, session.id),
        set: {
          weightKg: item.weightKg,
          reps: item.reps,
          setIndex: item.setIndex,
          // повторная отправка без ощущения не стирает уже выставленное
          feeling: sql`coalesce(excluded.feeling, ${setLogs.feeling})`,
          loggedOffline: item.loggedOffline ? 1 : 0,
          updatedAt: new Date(),
        },
      })
      .returning({ id: setLogs.id })

    if (written.length > 0) accepted.push(item.clientUuid)
    else rejected.push(item.clientUuid)
  }

  return { accepted, rejected }
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
  // повторное завершение (ответ потерялся, клиент повторил) — ничего не меняет и не дублирует задачу
  if (session.finishedAt) return

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
  options: { finishedOnly?: boolean } = {},
): Promise<HistorySession[]> {
  // Ограничение по числу тренировок делается в SQL (F15): иначе читается вся история.
  const finishedCondition = options.finishedOnly
    ? sql`and ws.finished_at is not null`
    : sql``

  const rows = await db.execute<{
    session_id: string
    started_at: Date
    weight_kg: number
    reps: number
    feeling: 'easy' | 'good' | 'hard' | null
    set_index: number
  }>(sql`
    with recent as (
      select ws.id, ws.started_at
      from workout_sessions ws
      where ws.user_id = ${userId}
        ${finishedCondition}
        and exists (
          select 1 from set_logs sl
          where sl.session_id = ws.id and sl.exercise_id = ${exerciseId}
        )
      order by ws.started_at desc
      limit ${limit}
    )
    select sl.session_id, r.started_at, sl.weight_kg, sl.reps, sl.feeling, sl.set_index
    from set_logs sl
    join recent r on r.id = sl.session_id
    where sl.exercise_id = ${exerciseId}
    order by r.started_at desc, sl.set_index asc
  `)

  const bySession = new Map<string, HistorySession>()

  for (const row of rows) {
    const entry = bySession.get(row.session_id) ?? { date: new Date(row.started_at), sets: [] }
    entry.sets.push({ weightKg: Number(row.weight_kg), reps: row.reps, feeling: row.feeling })
    bySession.set(row.session_id, entry)
  }

  return [...bySession.values()]
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

/** День последней завершённой тренировки — от него считаем «следующий день». */
export async function getLastFinishedDayId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ dayId: workoutSessions.programDayId })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), sql`${workoutSessions.finishedAt} is not null`))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1)

  return row?.dayId ?? null
}

/** Серия недели: 7 флагов Пн–Вс, заполненные — дни с завершённой тренировкой. */
export async function getWeekWorkoutDays(
  userId: string,
  now: Date = new Date(),
  timeZone = 'UTC',
): Promise<boolean[]> {
  // Берём только последние две недели: серия считается в пределах текущей недели.
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({ finishedAt: workoutSessions.finishedAt })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        sql`${workoutSessions.finishedAt} is not null`,
        sql`${workoutSessions.finishedAt} >= ${windowStart.toISOString()}::timestamptz`,
      ),
    )

  const todayKey = dayKey(now, timeZone)
  const [year, month, day] = todayKey.split('-').map(Number)
  const todayUtc = Date.UTC(year!, month! - 1, day!)
  const weekday = new Date(todayUtc).getUTCDay()
  const mondayUtc = todayUtc - ((weekday + 6) % 7) * 24 * 60 * 60 * 1000

  const result = [false, false, false, false, false, false, false]

  for (const row of rows) {
    if (!row.finishedAt) continue

    const key = dayKey(row.finishedAt, timeZone)
    const [rowYear, rowMonth, rowDay] = key.split('-').map(Number)
    const diff = Math.round(
      (Date.UTC(rowYear!, rowMonth! - 1, rowDay!) - mondayUtc) / (24 * 60 * 60 * 1000),
    )

    if (diff >= 0 && diff < 7) result[diff] = true
  }

  return result
}
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

export type ExerciseProgressPoint = { date: Date; workingWeightKg: number }

/**
 * Рабочий вес по завершённым тренировкам: максимум сессии (как в `recommend()`),
 * по возрастанию даты.
 */
export async function getExerciseProgress(
  userId: string,
  exerciseId: string,
  options: { limit?: number } = {},
): Promise<ExerciseProgressPoint[]> {
  const limit = options.limit ?? 40

  const rows = await db.execute<{ started_at: Date; weight_kg: number }>(sql`
    with recent as (
      select ws.id, ws.started_at
      from workout_sessions ws
      where ws.user_id = ${userId}
        and ws.finished_at is not null
        and exists (
          select 1 from set_logs sl
          where sl.session_id = ws.id and sl.exercise_id = ${exerciseId}
        )
      order by ws.started_at desc
      limit ${limit}
    )
    select r.started_at, max(sl.weight_kg) as weight_kg
    from set_logs sl
    join recent r on r.id = sl.session_id
    where sl.exercise_id = ${exerciseId}
    group by r.id, r.started_at
    order by r.started_at asc
  `)

  return rows.map((row) => ({
    date: new Date(row.started_at),
    workingWeightKg: Number(row.weight_kg),
  }))
}

/** Сколько завершённых тренировок было у клиентов с момента `since`. */
export async function countFinishedSessionsSince(
  userIds: string[],
  since: Date,
): Promise<number> {
  if (userIds.length === 0) return 0

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workoutSessions)
    .where(
      and(
        inArray(workoutSessions.userId, userIds),
        sql`${workoutSessions.finishedAt} is not null`,
        gte(workoutSessions.startedAt, since),
      ),
    )

  return row?.count ?? 0
}

/** Последняя тренировка каждого клиента — строка списка «Клиенты». */
export async function getLastWorkoutDates(userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map()

  const rows = await db
    .select({ userId: workoutSessions.userId, startedAt: workoutSessions.startedAt })
    .from(workoutSessions)
    .where(inArray(workoutSessions.userId, userIds))
    .orderBy(desc(workoutSessions.startedAt))

  const result = new Map<string, Date>()
  for (const row of rows) {
    if (!result.has(row.userId)) result.set(row.userId, row.startedAt)
  }

  return result
}

/** Незавершённые тренировки клиентов, начатые не раньше `since` — лента «Тренируются сейчас». */
export async function listOngoingSessions(
  userIds: string[],
  since: Date,
): Promise<{ userId: string; sessionId: string; startedAt: Date }[]> {
  if (userIds.length === 0) return []

  const rows = await db
    .select({
      userId: workoutSessions.userId,
      sessionId: workoutSessions.id,
      startedAt: workoutSessions.startedAt,
    })
    .from(workoutSessions)
    .where(
      and(
        inArray(workoutSessions.userId, userIds),
        isNull(workoutSessions.finishedAt),
        gte(workoutSessions.startedAt, since),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt))

  return rows
}

/** Упражнения, по которым есть хотя бы одна завершённая тренировка. */
export async function getTrainedExercises(
  userId: string,
): Promise<{ exerciseId: string; name: string; sessions: number }[]> {
  const rows = await db.execute<{ exercise_id: string; name: string | null; sessions: number }>(sql`
    select sl.exercise_id, e.name, count(distinct ws.id)::int as sessions
    from set_logs sl
    join workout_sessions ws on ws.id = sl.session_id
    left join exercises e on e.id = sl.exercise_id
    where ws.user_id = ${userId} and ws.finished_at is not null
    group by sl.exercise_id, e.name
    order by sessions desc, e.name asc
  `)

  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    name: row.name ?? 'Упражнение',
    sessions: row.sessions,
  }))
}

/** Сумма вес×повторения по неделям; недели без тренировок — нули, чтобы столбцы шли подряд. */
export async function getWeeklyVolume(
  userId: string,
  weeks = 8,
  timeZone = 'UTC',
): Promise<{ weekStart: string; volumeKg: number }[]> {
  const currentMonday = mondayKey(new Date(), timeZone)

  const starts: string[] = []
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const monday = new Date(`${currentMonday}T00:00:00Z`)
    monday.setUTCDate(monday.getUTCDate() - index * 7)
    starts.push(dayKey(monday, 'UTC'))
  }

  const oldest = new Date(`${starts[0]!}T00:00:00Z`)

  const rows = await db
    .select({
      finishedAt: workoutSessions.finishedAt,
      weightKg: setLogs.weightKg,
      reps: setLogs.reps,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        sql`${workoutSessions.finishedAt} is not null`,
        sql`${workoutSessions.finishedAt} >= ${oldest.toISOString()}::timestamptz`,
      ),
    )

  const totals = new Map<string, number>(starts.map((start) => [start, 0]))

  for (const row of rows) {
    if (!row.finishedAt) continue
    const key = mondayKey(row.finishedAt, timeZone)
    if (!totals.has(key)) continue
    totals.set(key, (totals.get(key) ?? 0) + Number(row.weightKg) * row.reps)
  }

  return starts.map((start) => ({ weekStart: start, volumeKg: Math.round(totals.get(start) ?? 0) }))
}