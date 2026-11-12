import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { formatScheme } from '@/shared/scheme'
import { getModelName, withFallback } from './provider'
import { recordUsage } from './usage'
import type { TemplateCatalogItem } from './template-draft'

export type ReviewDay = {
  name: string
  exercises: { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number }[]
}

export type TemplateIssue = {
  day: string
  text: string
  severity: 'error' | 'warning'
}

/** Крупные мышцы: если их нет ни в одном упражнении дня — день «пустой» по нагрузке. */
const BIG_MUSCLES = ['quads', 'hamstrings', 'glutes', 'lats', 'chest', 'lower-back']

/**
 * Проверка дней шаблона: то, что Максим увидел бы глазами. Чистая функция —
 * её покрывают тесты, а ИИ только объясняет результат словами.
 */
export function reviewTemplate(days: ReviewDay[], catalog: TemplateCatalogItem[]): TemplateIssue[] {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const issues: TemplateIssue[] = []

  for (const day of days) {
    const dayName = day.name || 'День'

    if (day.exercises.length === 0) {
      issues.push({ day: dayName, text: 'в дне нет упражнений', severity: 'error' })
      continue
    }

    const seen = new Set<string>()
    for (const item of day.exercises) {
      if (seen.has(item.exerciseId)) {
        const name = byId.get(item.exerciseId)?.name ?? 'упражнение'
        issues.push({ day: dayName, text: `«${name}» повторяется в дне`, severity: 'error' })
      }
      seen.add(item.exerciseId)

      if (item.repMin > item.repMax) {
        const name = byId.get(item.exerciseId)?.name ?? 'упражнение'
        issues.push({ day: dayName, text: `у «${name}» повторений от больше, чем до`, severity: 'error' })
      }

      if (item.sets < 2 || item.sets > 6) {
        const name = byId.get(item.exerciseId)?.name ?? 'упражнение'
        issues.push({
          day: dayName,
          text: `у «${name}» ${item.sets} подходов — обычно 2–6`,
          severity: 'warning',
        })
      }

      if (item.restSec < 30) {
        const name = byId.get(item.exerciseId)?.name ?? 'упражнение'
        issues.push({
          day: dayName,
          text: `у «${name}» отдых ${item.restSec} с — маловато`,
          severity: 'warning',
        })
      }
    }

    if (day.exercises.length > 8) {
      issues.push({
        day: dayName,
        text: `${day.exercises.length} упражнений — день затянется, обычно 5–7`,
        severity: 'warning',
      })
    }

    const muscles = new Set<string>()
    for (const item of day.exercises) {
      for (const code of byId.get(item.exerciseId)?.primary ?? []) muscles.add(code)
    }

    if (muscles.size === 1) {
      const only = [...muscles][0]!
      issues.push({
        day: dayName,
        text: `все упражнения на одну группу (${only}) — добавь другие`,
        severity: 'warning',
      })
    }

    if (muscles.size > 0 && ![...muscles].some((code) => BIG_MUSCLES.includes(code))) {
      issues.push({
        day: dayName,
        text: 'нет упражнений на крупные мышцы — добавь ноги, спину или грудь',
        severity: 'warning',
      })
    }
  }

  return issues
}

const reviewSchema = z.object({
  summary: z.string(),
  days: z.array(z.object({ day: z.string(), note: z.string() })).max(7),
})

export type TemplateAiReview = {
  summary: string
  notes: { day: string; note: string }[]
}

const REVIEW_INSTRUCTION = [
  'Ты помощник тренера Максима. Посмотри на шаблон программы и скажи по-русски, что в нём хорошо и что поправить.',
  'Коротко: summary — 1–2 предложения на весь шаблон, note — до 120 символов на день.',
  'Не выдумывай упражнений, которых нет в списке. Без эмодзи и медицинских советов.',
].join('\n')

export type TemplateReviewDeps = {
  getModel?: (kind: 'main' | 'fast' | 'fallback') => LanguageModel
  timeoutMs?: number
  userId?: string
}

/**
 * Разбор шаблона словами МаксИИма: подсказки по каждому дню. Если модель недоступна —
 * вызывающий код показывает только детерминированные замечания (см. `reviewTemplate`).
 */
export async function reviewTemplateWithAi(
  days: ReviewDay[],
  catalog: TemplateCatalogItem[],
  deps: TemplateReviewDeps = {},
): Promise<TemplateAiReview> {
  const byId = new Map(catalog.map((item) => [item.id, item]))

  const text = days
    .map((day) => {
      const items = day.exercises
        .map((item) => {
          const entry = byId.get(item.exerciseId)
          return `  - ${entry?.name ?? 'упражнение'}: ${formatScheme(item.sets, item.repMin, item.repMax)}`
        })
        .join('\n')

      return `${day.name}\n${items}`
    })
    .join('\n\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: reviewSchema,
        prompt: `${REVIEW_INSTRUCTION}\n\nШаблон:\n${text}`,
      }),
    'fast',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 30_000 },
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
    summary: result.object.summary.trim().slice(0, 400),
    notes: result.object.days
      .map((item) => ({ day: item.day.trim(), note: item.note.trim().slice(0, 200) }))
      .filter((item) => item.note.length > 0),
  }
}
