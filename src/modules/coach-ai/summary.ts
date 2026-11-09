import { and, eq } from 'drizzle-orm'
import { generateText, type LanguageModel } from 'ai'
import { exercises } from '@/modules/catalog'
import type { Recommendation } from '@/modules/progression'
import { getRecommendations, setLogs, workoutSessions } from '@/modules/training'
import { db } from '@/shared/db'
import { AiUnavailableError, getModelName, withFallback } from './provider'
import { recordUsage } from './usage'

const SUMMARY_INSTRUCTION =
  'Напиши итог тренировки клиенту в 1–2 предложениях (до 240 символов), на „ты“, с одной конкретной деталью из данных. Без эмодзи.'

export const SUMMARY_LIMIT = 240

const FEELING_RU: Record<string, string> = { easy: 'легко', good: 'нормально', hard: 'тяжело' }

/** Вес для модели: запятая и без хвоста «.0», чтобы итог не сыпал «62.3» и «×». */
function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

export type SummaryExercise = {
  exerciseId: string
  name: string
  sets: { weightKg: number; reps: number; feeling: string | null }[]
}

export type SummarySession = {
  startedAt: Date
  finishedAt: Date | null
  mode: 'free' | 'guided'
}

/** Данные для модели: только цифры тренировки и рекомендации алгоритма. */
export function buildSummaryInput(
  session: SummarySession,
  recordsByExercise: SummaryExercise[],
  recommendations: Record<string, Recommendation> = {},
): string {
  const lines: string[] = []
  const durationMin = session.finishedAt
    ? Math.max(1, Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60000))
    : null

  lines.push(
    `Тренировка ${session.startedAt.toLocaleDateString('ru-RU')}, режим ${session.mode === 'guided' ? 'пошаговый' : 'свободный'}${durationMin ? `, ${durationMin} мин` : ''}.`,
  )

  let volume = 0
  for (const exercise of recordsByExercise) {
    volume += exercise.sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0)
    const sets = exercise.sets
      .map(
        (set) =>
          `${formatKg(set.weightKg)} кг, ${set.reps} раз${set.feeling ? ` (${FEELING_RU[set.feeling] ?? set.feeling})` : ''}`,
      )
      .join(', ')
    const recommendation = recommendations[exercise.exerciseId]
    const next =
      recommendation && recommendation.weightKg !== null
        ? ` Следующий раз: ${formatKg(recommendation.weightKg)} кг.`
        : ''

    lines.push(`- ${exercise.name}: ${sets}.${next}`)
  }

  lines.push(`Объём: ${Math.round(volume)} кг.`)
  return lines.join('\n')
}

/** Обрезает по границе слова, чтобы не рвать слово в итоге. */
export function trimToWord(text: string, limit = SUMMARY_LIMIT): string {
  if (text.length <= limit) return text

  const slice = text.slice(0, limit)
  const cut = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'))
  return (cut > 0 ? slice.slice(0, cut) : slice).trimEnd()
}

type SummaryDeps = {
  generate?: typeof generateText
  getModel?: (kind: 'main' | 'fast' | 'fallback') => LanguageModel
  timeoutMs?: number
}

async function loadSummaryData(sessionId: string) {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1)

  if (!session) return null

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
    .orderBy(setLogs.exerciseId, setLogs.setIndex)

  const grouped = new Map<string, SummaryExercise>()

  for (const row of rows) {
    const entry = grouped.get(row.exerciseId) ?? {
      exerciseId: row.exerciseId,
      name: row.name ?? 'Упражнение',
      sets: [],
    }
    entry.sets.push({ weightKg: row.weightKg, reps: row.reps, feeling: row.feeling })
    grouped.set(row.exerciseId, entry)
  }

  const recommendations = session.programDayId
    ? await getRecommendations(session.userId, session.programDayId)
    : {}

  return { session, records: [...grouped.values()], recommendations }
}

/** Один вызов AI_MODEL_FAST; недоступность ИИ не ломает завершение тренировки. */
export async function summarizeSession(
  sessionId: string,
  deps: SummaryDeps = {},
): Promise<string | null> {
  const data = await loadSummaryData(sessionId)
  if (!data) return null

  // Повторная доставка задачи или повторное завершение: итог уже есть, модель не зовём.
  if (data.session.aiSummary) return data.session.aiSummary

  const input = buildSummaryInput(data.session, data.records, data.recommendations)
  const run = deps.generate ?? generateText

  try {
    const result = await withFallback(
      async (model) => run({ model, prompt: `${SUMMARY_INSTRUCTION}\n\n${input}` }),
      'fast',
      { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 30_000 },
    )

    await recordUsage(data.session.userId, {
      model: getModelName('fast'),
      tokensIn: result.usage?.inputTokens ?? 0,
      tokensOut: result.usage?.outputTokens ?? 0,
      countsTowardLimit: false,
    }).catch(() => undefined)

    const summary = trimToWord(result.text.trim())
    if (!summary) return null

    await db
      .update(workoutSessions)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(eq(workoutSessions.id, sessionId))

    return summary
  } catch (error) {
    if (error instanceof AiUnavailableError) return null
    throw error
  }
}

/** Итог тренировки для экрана завершения (опрос раз в 2 с). */
export async function getSessionAiSummary(
  userId: string,
  sessionClientUuid: string,
): Promise<string | null> {
  const [row] = await db
    .select({ aiSummary: workoutSessions.aiSummary })
    .from(workoutSessions)
    .where(
      and(eq(workoutSessions.userId, userId), eq(workoutSessions.clientUuid, sessionClientUuid)),
    )
    .limit(1)

  return row?.aiSummary ?? null
}
