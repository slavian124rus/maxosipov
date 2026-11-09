import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { detectFlag, type PainFlag } from './flags'
import { withFallback } from './provider'

export type VoiceRow = {
  exerciseId: string | null
  spokenName: string
  sets: { weightKg: number; reps: number }[]
  feeling: 'easy' | 'good' | 'hard' | null
}

export type VoiceParseResult = {
  rows: VoiceRow[]
  flag: PainFlag | null
}

const voiceSchema = z.object({
  rows: z
    .array(
      z.object({
        spokenName: z.string().max(120),
        exerciseId: z.string().nullable().optional(),
        sets: z
          .array(
            z.object({
              weightKg: z.number().min(0).max(1000),
              reps: z.number().int().min(1).max(200),
            }),
          )
          .max(20),
        feeling: z.enum(['easy', 'good', 'hard']).nullable().optional(),
      }),
    )
    .max(20),
})

export type VoiceDeps = {
  getModel?: (kind: 'main' | 'fast' | 'fallback') => LanguageModel
  timeoutMs?: number
}

const INSTRUCTION =
  'Разбери голосовой отчёт о тренировке. Верни только то, что человек реально сделал: упражнение, подходы (вес в кг, повторения) и ощущение. Упражнение выбирай только из списка; если его там нет — exerciseId: null и сохрани название как сказал человек. Не придумывай подходы.'

/**
 * Разбор голоса: `AI_MODEL_FAST` со схемой Zod. Упражнения — только из текущей тренировки,
 * флаг боли/травмы ставит код (`detectFlag`), а не модель.
 */
export async function parseVoiceLog(
  text: string,
  sessionExercises: { id: string; name: string }[],
  deps: VoiceDeps = {},
): Promise<VoiceParseResult> {
  const allowed = new Set(sessionExercises.map((exercise) => exercise.id))
  const catalog = sessionExercises.map((exercise) => `${exercise.id} — ${exercise.name}`).join('\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: voiceSchema,
        prompt: `${INSTRUCTION}\n\nУпражнения тренировки:\n${catalog || 'список пуст'}\n\nТекст: ${text}`,
      }),
    'fast',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 30_000 },
  )

  const rows: VoiceRow[] = result.object.rows.map((row) => ({
    // Модель могла вернуть id не из списка — не доверяем.
    exerciseId: row.exerciseId && allowed.has(row.exerciseId) ? row.exerciseId : null,
    spokenName: row.spokenName,
    sets: row.sets,
    feeling: row.feeling ?? null,
  }))

  return { rows, flag: detectFlag(text) }
}