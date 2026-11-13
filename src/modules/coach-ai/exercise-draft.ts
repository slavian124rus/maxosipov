import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { getModelName, withFallback, type ModelKind } from './provider'
import { recordUsage } from './usage'

export type ExerciseDraftInput = {
  name: string
  machine: string | null
  primary: string[]
  secondary: string[]
}

export type ExerciseDraft = {
  steps: string[]
  mistakes: string[]
  tip: string
}

export const STEP_LIMIT = 140
export const MISTAKE_LIMIT = 120
export const TIP_LIMIT = 160

const draftSchema = z.object({
  steps: z.array(z.string()).max(20),
  mistakes: z.array(z.string()).max(20),
  tip: z.string(),
})

export type ExerciseDraftDeps = {
  getModel?: (kind: ModelKind) => LanguageModel
  timeoutMs?: number
  /** Кто просит черновик — для учёта расходов. */
  userId?: string
}

const INSTRUCTION =
  'Составь описание упражнения для зала. 3–5 шагов «как делать» (каждый до 140 символов, на «ты», повелительное наклонение), 2–4 частые ошибки (до 120 символов) и один совет (до 160 символов). Без эмодзи, без медицинских рекомендаций.'

function clip(text: string, limit: number): string {
  return text.trim().slice(0, limit).trim()
}

function cleanList(items: string[], max: number, limit: number): string[] {
  return items
    .map((item) => clip(item, limit))
    .filter((item) => item.length > 0)
    .slice(0, max)
}

/**
 * Черновик текста упражнения для Максима: `AI_MODEL_MAIN`, поля он всё равно правит руками.
 * Право `catalog.edit` проверяет вызывающее серверное действие.
 */
export async function draftExerciseText(
  input: ExerciseDraftInput,
  deps: ExerciseDraftDeps = {},
): Promise<ExerciseDraft> {
  const context = [
    `Название: ${input.name}`,
    `Тренажёр: ${input.machine ?? 'свободные веса'}`,
    `Основные мышцы: ${input.primary.join(', ') || 'не указаны'}`,
    `Помогающие мышцы: ${input.secondary.join(', ') || 'не указаны'}`,
  ].join('\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: draftSchema,
        prompt: `${INSTRUCTION}\n\n${context}`,
      }),
    'exercises',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 30_000 },
  )

  if (deps.userId) {
    await recordUsage(deps.userId, {
      model: getModelName('exercises'),
      tokensIn: result.usage?.inputTokens ?? 0,
      tokensOut: result.usage?.outputTokens ?? 0,
      countsTowardLimit: false,
    }).catch(() => undefined)
  }

  return {
    steps: cleanList(result.object.steps, 5, STEP_LIMIT),
    mistakes: cleanList(result.object.mistakes, 4, MISTAKE_LIMIT),
    tip: clip(result.object.tip, TIP_LIMIT),
  }
}
