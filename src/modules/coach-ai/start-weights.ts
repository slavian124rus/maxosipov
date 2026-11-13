import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { StartWeightProfile } from '@/modules/progression'
import { getModelName, withFallback, type ModelKind } from './provider'
import { recordUsage } from './usage'

/** Упражнение программы в объёме, нужном для подбора весов. */
export type WeightExerciseInput = {
  exerciseId: string
  name: string
  machineName: string | null
  primary: string[]
  /** Шаг веса тренажёра, кг. 0 — без веса. */
  stepKg: number
  sets: number
  repMin: number
  repMax: number
}

export type WeightSuggestion = {
  exerciseId: string
  weightKg: number
  reason: string
}

export type WeightSuggestions = {
  summary: string
  items: WeightSuggestion[]
}

const suggestionSchema = z.object({
  summary: z.string(),
  items: z
    .array(
      z.object({
        exerciseId: z.string(),
        weightKg: z.number(),
        reason: z.string(),
      }),
    )
    .max(80),
})

const EXPERIENCE_RU: Record<StartWeightProfile['experience'], string> = {
  novice: 'новичок (занимается меньше года)',
  intermediate: 'средний уровень (1–3 года)',
  advanced: 'опытный (больше 3 лет)',
}

const GOAL_RU: Record<StartWeightProfile['goal'], string> = {
  strength: 'сила',
  mass: 'набор массы',
  fat_loss: 'похудение',
  health: 'здоровье и тонус',
}

const INSTRUCTION = [
  'Ты помощник тренера Максима в зале «Колизей». Подбери стартовые рабочие веса на первую тренировку.',
  'Правила:',
  '- Безопасность важнее результата: лучше легче, клиент добавит на следующей тренировке.',
  '- Учитывай пол, возраст, рост, вес, опыт, цель и число тренировок в неделю.',
  '- Новичку — около 50–65 % от того, что поднял бы опытный; женщинам для верха тела — ниже.',
  '- Упражнение с собственным весом (пресс, отжимания, брусья) — 0 кг.',
  '- Вес кратен шагу тренажёра (поле «шаг»), иначе тренажёр его не набрать.',
  '- reason — до 60 символов, по-русски, без эмодзи: почему именно столько.',
  '- Верни ровно те exerciseId, что даны в списке.',
].join('\n')

function clampWeight(value: number, stepKg: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(stepKg) || stepKg <= 0) return 0

  const rounded = Math.round(value / stepKg) * stepKg
  return Math.min(250, Math.max(stepKg, Math.round(rounded * 100) / 100))
}

/**
 * Проверяет ответ модели: неизвестные упражнения, отрицательные веса и «неудобные»
 * значения отбрасываются или округляются до шага тренажёра. Чистая функция — под тестами.
 */
export function sanitizeWeightSuggestions(
  raw: { items: { exerciseId: string; weightKg: number; reason: string }[] },
  exercises: WeightExerciseInput[],
): WeightSuggestion[] {
  const byId = new Map(exercises.map((item) => [item.exerciseId, item]))
  const result: WeightSuggestion[] = []
  const seen = new Set<string>()

  for (const item of raw.items) {
    const exercise = byId.get(item.exerciseId)
    if (!exercise || seen.has(item.exerciseId)) continue

    seen.add(item.exerciseId)
    result.push({
      exerciseId: item.exerciseId,
      weightKg: clampWeight(item.weightKg, exercise.stepKg),
      reason: item.reason.trim().slice(0, 80) || 'по анкете',
    })
  }

  return result
}

export type WeightSuggestionDeps = {
  getModel?: (kind: ModelKind) => LanguageModel
  timeoutMs?: number
  userId?: string
}

/**
 * Подбор стартовых весов МаксИИмом (DESIGN.md §8.9): тренер видит предпросмотр
 * с обоснованием и применяет его одной кнопкой. Если модель недоступна — вызывающий
 * код берёт расчёт по анкете, экран не ломается.
 */
export async function suggestStartWeights(
  profile: StartWeightProfile,
  exercises: WeightExerciseInput[],
  deps: WeightSuggestionDeps = {},
): Promise<WeightSuggestions> {
  if (exercises.length === 0) return { summary: 'В программе нет упражнений', items: [] }

  const age = new Date().getFullYear() - profile.birthYear

  const brief = [
    `Пол: ${profile.sex === 'male' ? 'мужской' : 'женский'}`,
    `Возраст: ${age}`,
    `Рост: ${profile.heightCm} см`,
    `Вес: ${profile.weightKg} кг`,
    `Опыт: ${EXPERIENCE_RU[profile.experience]}`,
    `Цель: ${GOAL_RU[profile.goal]}`,
    `Тренировок в неделю: ${profile.sessionsPerWeek}`,
  ].join('\n')

  const list = exercises
    .map(
      (item) =>
        `${item.exerciseId} | ${item.name} | ${item.machineName ?? 'свободные веса'} | шаг ${item.stepKg} кг | ${item.sets}×${item.repMin}–${item.repMax} | мышцы: ${item.primary.join(', ') || '—'}`,
    )
    .join('\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: suggestionSchema,
        prompt: `${INSTRUCTION}\n\nАнкета клиента:\n${brief}\n\nУпражнения (id | название | тренажёр | шаг | подходы×повторения | мышцы):\n${list}`,
      }),
    'fast',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 45_000 },
  )

  if (deps.userId) {
    await recordUsage(deps.userId, {
      model: getModelName('fast'),
      tokensIn: result.usage?.inputTokens ?? 0,
      tokensOut: result.usage?.outputTokens ?? 0,
      countsTowardLimit: false,
    }).catch(() => undefined)
  }

  return {
    summary: result.object.summary.trim().slice(0, 400) || 'Веса подобраны по анкете',
    items: sanitizeWeightSuggestions(result.object, exercises),
  }
}
