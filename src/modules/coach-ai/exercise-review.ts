import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { MUSCLES, isMuscleCode } from '@/shared/muscles'
import { getModelName, withFallback, type ModelKind } from './provider'
import { recordUsage } from './usage'

/** Карточка упражнения в объёме, нужном для проверки. */
export type ExerciseReviewInput = {
  name: string
  machine: string | null
  primary: string[]
  secondary: string[]
  steps: string[]
  mistakes: string[]
  tip: string | null
  repMin: number
  repMax: number
  hasVideo: boolean
  hasPhoto: boolean
}

export type ExerciseIssueField = 'name' | 'muscles' | 'reps' | 'steps' | 'mistakes' | 'tip' | 'media'

export type ExerciseIssue = {
  field: ExerciseIssueField
  text: string
  severity: 'error' | 'warning'
}

export type ExerciseFix = {
  name: string
  repMin: number
  repMax: number
  steps: string[]
  mistakes: string[]
  tip: string
  primary: string[]
  secondary: string[]
}

export type ExerciseAiReview = {
  summary: string
  fix: ExerciseFix
}

const STEP_LIMIT = 140
const MISTAKE_LIMIT = 120
const TIP_LIMIT = 160
const NAME_LIMIT = 60

function clean(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean)
}

function hasDuplicates(items: string[]): string[] {
  const seen = new Map<string, number>()
  for (const item of items) {
    const key = item.trim().toLowerCase()
    if (!key) continue
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  return [...seen.entries()].filter(([, count]) => count > 1).map(([text]) => text)
}

/**
 * Детерминированная проверка карточки упражнения (DESIGN.md §8.9).
 *
 * Считается без ИИ: тренер видит одни и те же замечания на любом устройстве и без сети,
 * а МаксИИм потом объясняет их словами и предлагает исправления.
 */
export function reviewExercise(input: ExerciseReviewInput): ExerciseIssue[] {
  const issues: ExerciseIssue[] = []
  const steps = clean(input.steps)
  const mistakes = clean(input.mistakes)
  const name = input.name.trim()

  if (name.length < 3) {
    issues.push({ field: 'name', text: 'Название короче 3 символов', severity: 'error' })
  } else if (name.length > NAME_LIMIT) {
    issues.push({
      field: 'name',
      text: `Название длиннее ${NAME_LIMIT} символов — в дереве оно обрежется`,
      severity: 'warning',
    })
  }

  if (input.primary.length === 0) {
    issues.push({
      field: 'muscles',
      text: 'Не отмечена ни одна основная мышца — без неё упражнение не опубликовать',
      severity: 'error',
    })
  }

  const overlap = input.primary.filter((code) => input.secondary.includes(code))
  if (overlap.length > 0) {
    issues.push({
      field: 'muscles',
      text: `Мышца указана и основной, и помогающей: ${overlap.join(', ')}`,
      severity: 'warning',
    })
  }

  if (input.repMin > input.repMax) {
    issues.push({ field: 'reps', text: 'Повторений «от» больше, чем «до»', severity: 'error' })
  } else if (input.repMin < 1 || input.repMax > 50) {
    issues.push({
      field: 'reps',
      text: 'Повторения вне разумных границ (1–50)',
      severity: 'error',
    })
  } else if (input.repMax > 20) {
    issues.push({
      field: 'reps',
      text: 'Больше 20 повторений — для силового зала это редкость, проверь',
      severity: 'warning',
    })
  }

  if (steps.length === 0) {
    issues.push({ field: 'steps', text: 'Нет шагов «Как делать»', severity: 'error' })
  } else if (steps.length < 3) {
    issues.push({
      field: 'steps',
      text: `Шагов ${steps.length} — клиенту сложно повторить, лучше 3–5`,
      severity: 'warning',
    })
  }

  const longSteps = steps.filter((step) => step.length > STEP_LIMIT)
  if (longSteps.length > 0) {
    issues.push({
      field: 'steps',
      text: `Шаг длиннее ${STEP_LIMIT} символов — на телефоне читать неудобно`,
      severity: 'warning',
    })
  }

  const duplicated = hasDuplicates(steps)
  if (duplicated.length > 0) {
    issues.push({ field: 'steps', text: `Шаг повторяется: ${duplicated[0]}`, severity: 'warning' })
  }

  if (mistakes.length === 0) {
    issues.push({
      field: 'mistakes',
      text: 'Нет частых ошибок — это первое, что смотрит клиент',
      severity: 'warning',
    })
  }

  if (!input.tip?.trim()) {
    issues.push({ field: 'tip', text: 'Нет совета тренера', severity: 'warning' })
  }

  if (!input.hasVideo && !input.hasPhoto) {
    issues.push({
      field: 'media',
      text: 'Нет ни видео, ни фото тренажёра — в карточке будет пусто',
      severity: 'warning',
    })
  }

  if (!input.hasVideo) {
    issues.push({
      field: 'media',
      text: 'Видео нет — клиент не увидит технику на тренировке',
      severity: 'warning',
    })
  }

  return issues
}

const fixSchema = z.object({
  summary: z.string(),
  name: z.string(),
  repMin: z.number(),
  repMax: z.number(),
  steps: z.array(z.string()).max(8),
  mistakes: z.array(z.string()).max(6),
  tip: z.string(),
  primary: z.array(z.string()).max(6),
  secondary: z.array(z.string()).max(8),
})

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.round(value), min), max)
}

function clipList(items: string[], max: number, limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const text = item.trim().slice(0, limit).trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= max) break
  }

  return result
}

/**
 * Проверяет предложенные МаксИИмом исправления: неизвестные коды мышц отбрасываются,
 * повторы зажимаются в 1–50, тексты обрезаются, пустые поля остаются как были —
 * чтобы «Применить» никогда не портило карточку.
 */
export function sanitizeExerciseFix(
  raw: {
    name: string
    repMin: number
    repMax: number
    steps: string[]
    mistakes: string[]
    tip: string
    primary: string[]
    secondary: string[]
  },
  input: ExerciseReviewInput,
): ExerciseFix {
  const primary = [...new Set(raw.primary.filter(isMuscleCode))]
  const secondary = [...new Set(raw.secondary.filter(isMuscleCode))].filter(
    (code) => !primary.includes(code),
  )

  const repMin = clamp(raw.repMin, 1, 50)
  const repMax = Math.max(repMin, clamp(raw.repMax, 1, 50))

  return {
    name: raw.name.trim().slice(0, NAME_LIMIT) || input.name,
    repMin,
    repMax,
    steps: clipList(raw.steps, 6, STEP_LIMIT),
    mistakes: clipList(raw.mistakes, 4, MISTAKE_LIMIT),
    tip: raw.tip.trim().slice(0, TIP_LIMIT),
    primary: primary.length > 0 ? primary : input.primary,
    secondary,
  }
}

export type ExerciseReviewDeps = {
  getModel?: (kind: ModelKind) => LanguageModel
  timeoutMs?: number
  userId?: string
}

const INSTRUCTION = [
  'Ты помощник тренера Максима в зале «Колизей». Проверь карточку упражнения и верни исправленную версию.',
  'Правила:',
  '- Название: короткое и точное, до 60 символов, по-русски, без эмодзи.',
  '- 3–5 шагов «как делать», каждый до 140 символов, на «ты», повелительное наклонение.',
  '- 2–4 частые ошибки, каждая до 120 символов.',
  '- Один совет тренера до 160 символов.',
  '- Основные мышцы — 1–3 кода из списка, помогающие — 0–4 кода, без пересечений с основными.',
  '- Повторения в разумных пределах (обычно 6–15), «от» не больше «до».',
  '- Используй только указанный тренажёр, не выдумывай другой инвентарь.',
  '- summary — 1–2 предложения: что было не так и что ты поправил.',
  '- Без медицинских рекомендаций и эмодзи.',
].join('\n')

/**
 * Разбор карточки МаксИИмом: короткое резюме и исправленные поля.
 * Тренер видит их и применяет сам — в карточку ничего не пишется автоматически.
 */
export async function reviewExerciseWithAi(
  input: ExerciseReviewInput,
  deps: ExerciseReviewDeps = {},
): Promise<ExerciseAiReview> {
  const muscleList = MUSCLES.map((muscle) => `${muscle.code} — ${muscle.nameRu}`).join(', ')

  const context = [
    `Название: ${input.name || 'не заполнено'}`,
    `Тренажёр: ${input.machine ?? 'свободные веса'}`,
    `Основные мышцы: ${input.primary.join(', ') || 'не указаны'}`,
    `Помогающие мышцы: ${input.secondary.join(', ') || 'не указаны'}`,
    `Повторения: ${input.repMin}–${input.repMax}`,
    `Шаги «как делать»: ${clean(input.steps).join(' | ') || 'нет'}`,
    `Частые ошибки: ${clean(input.mistakes).join(' | ') || 'нет'}`,
    `Совет: ${input.tip?.trim() || 'нет'}`,
    `Видео: ${input.hasVideo ? 'есть' : 'нет'}, фото тренажёра: ${input.hasPhoto ? 'есть' : 'нет'}`,
  ].join('\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: fixSchema,
        prompt: `${INSTRUCTION}\n\nДопустимые коды мышц:\n${muscleList}\n\nТекущая карточка:\n${context}`,
      }),
    'exercises',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 45_000 },
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
    summary: result.object.summary.trim().slice(0, 400) || 'Карточка проверена',
    fix: sanitizeExerciseFix(result.object, input),
  }
}

