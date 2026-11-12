import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { ProgramAudience, ProgramGoal } from '@/modules/training'
import { getModelName, withFallback } from './provider'
import { recordUsage } from './usage'

/** Упражнение каталога в объёме, нужном помощнику шаблонов. */
export type TemplateCatalogItem = {
  id: string
  name: string
  zone: string | null
  machine: string | null
  primary: string[]
}

export type TemplateBrief = {
  goal: ProgramGoal | null
  audience: ProgramAudience | null
  /** Сколько тренировок в неделю — столько дней и будет в шаблоне. */
  daysPerWeek: number
  level: 'novice' | 'intermediate' | 'advanced'
  note?: string | null
}

export type TemplateDraftExercise = {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  note: string | null
}

export type TemplateDraftDay = { name: string; exercises: TemplateDraftExercise[] }

export type TemplateDraft = {
  name: string
  days: TemplateDraftDay[]
}

const GOAL_RU: Record<ProgramGoal, string> = {
  strength: 'сила',
  mass: 'набор массы',
  fat_loss: 'похудение',
  health: 'здоровье и тонус',
}

const AUDIENCE_RU: Record<ProgramAudience, string> = {
  any: 'все',
  male: 'мужчины',
  female: 'женщины',
}

const LEVEL_RU: Record<TemplateBrief['level'], string> = {
  novice: 'новичок',
  intermediate: 'средний уровень',
  advanced: 'опытный',
}

const draftSchema = z.object({
  name: z.string(),
  days: z
    .array(
      z.object({
        name: z.string(),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string(),
              sets: z.number(),
              repMin: z.number(),
              repMax: z.number(),
              restSec: z.number(),
              note: z.string().nullable(),
            }),
          )
          .max(12),
      }),
    )
    .min(1)
    .max(7),
})

export type TemplateDraftDeps = {
  getModel?: (kind: 'main' | 'fast' | 'fallback') => LanguageModel
  timeoutMs?: number
  userId?: string
}

const INSTRUCTION = [
  'Ты помощник тренера Максима в зале «Колизей». Собери шаблон тренировочной программы.',
  'Правила:',
  '- Используй ТОЛЬКО упражнения из списка каталога, поле exerciseId — точный id из списка.',
  '- В каждом дне 4–7 упражнений: сначала крупные движения, потом вспомогательные.',
  '- Не повторяй одно упражнение в одном дне.',
  '- Подходы 2–5, повторения в разумном диапазоне (сила 4–8, масса 8–12, похудение 12–15, здоровье 10–15).',
  '- Отдых в секундах: 60–180.',
  '- Названия дней короткие и по-русски: «День 1 — ноги и пресс».',
  '- note — короткая подсказка тренеру или null.',
  '- Название шаблона: цель, для кого, например «Похудение для женщин».',
  'Без эмодзи, без медицинских рекомендаций.',
].join('\n')

function clip(text: string, limit: number): string {
  return text.trim().slice(0, limit).trim()
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.round(value), min), max)
}

/**
 * Черновик шаблона от МаксИИма: дни и упражнения из каталога зала.
 * Модель может ошибиться в id — всё, чего нет в каталоге, отбрасываем,
 * поэтому Максим видит только то, что реально можно поставить в программу.
 */
export async function draftProgramTemplate(
  brief: TemplateBrief,
  catalog: TemplateCatalogItem[],
  deps: TemplateDraftDeps = {},
): Promise<TemplateDraft> {
  const daysPerWeek = clamp(brief.daysPerWeek, 1, 7)

  const catalogText = catalog
    .map(
      (item) =>
        `${item.id} | ${item.name} | ${item.zone ?? 'без зоны'} | ${item.machine ?? 'свободные веса'} | ${item.primary.join(', ')}`,
    )
    .join('\n')

  const briefText = [
    `Цель: ${brief.goal ? GOAL_RU[brief.goal] : 'поддержать форму'}`,
    `Для кого: ${brief.audience ? AUDIENCE_RU[brief.audience] : 'все'}`,
    `Дней в неделю: ${daysPerWeek}`,
    `Уровень: ${LEVEL_RU[brief.level]}`,
    brief.note?.trim() ? `Пожелания тренера: ${clip(brief.note, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const result = await withFallback(
    async (model) =>
      generateObject({
        model,
        schema: draftSchema,
        prompt: `${INSTRUCTION}\n\nБриф:\n${briefText}\n\nКаталог (id | название | зона | тренажёр | основные мышцы):\n${catalogText}`,
      }),
    'main',
    { getModel: deps.getModel, timeoutMs: deps.timeoutMs ?? 60_000 },
  )

  if (deps.userId) {
    await recordUsage(deps.userId, {
      model: getModelName('main'),
      tokensIn: result.usage?.inputTokens ?? 0,
      tokensOut: result.usage?.outputTokens ?? 0,
      countsTowardLimit: false,
    }).catch(() => undefined)
  }

  const known = new Map(catalog.map((item) => [item.id, item]))
  const days: TemplateDraftDay[] = []

  for (const day of result.object.days.slice(0, daysPerWeek)) {
    const seen = new Set<string>()
    const exercises: TemplateDraftExercise[] = []

    for (const item of day.exercises) {
      if (!known.has(item.exerciseId) || seen.has(item.exerciseId)) continue
      seen.add(item.exerciseId)

      const repMin = clamp(item.repMin, 1, 50)
      exercises.push({
        exerciseId: item.exerciseId,
        sets: clamp(item.sets, 1, 10),
        repMin,
        repMax: Math.max(repMin, clamp(item.repMax, 1, 50)),
        restSec: clamp(item.restSec, 0, 600),
        note: item.note?.trim() ? clip(item.note, 200) : null,
      })
    }

    if (exercises.length > 0) {
      days.push({ name: clip(day.name, 80) || `День ${days.length + 1}`, exercises })
    }
  }

  if (days.length === 0) {
    throw new Error('МаксИИм не смог собрать дни — попробуй ещё раз')
  }

  return { name: clip(result.object.name, 80) || 'Новый шаблон', days }
}
