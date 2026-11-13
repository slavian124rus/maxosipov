import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/shared/db'
import { assertCan, type Actor } from '@/modules/rbac'
import {
  warmupTemplates,
  type WarmupFocus,
  type WarmupItem,
  type WarmupTemplate,
} from './schema'

const item = (
  title: string,
  zones: string[],
  amount: { durationSec: number } | { reps: number },
  note: string | null = null,
): WarmupItem => ({
  title,
  exerciseId: null,
  durationSec: 'durationSec' in amount ? amount.durationSec : null,
  reps: 'reps' in amount ? amount.reps : null,
  note,
  zones,
})

/** Шаблоны по умолчанию: по 5–7 минут. Максим правит их в админке. */
export const DEFAULT_WARMUPS: { name: string; focus: WarmupFocus; items: WarmupItem[] }[] = [
  {
    name: 'Разминка перед ногами',
    focus: 'legs',
    items: [
      item('Лёгкое кардио: дорожка или велотренажёр', [], { durationSec: 180 }, 'Темп, при котором можно говорить'),
      item('Круги коленями и тазом', ['knee', 'hip'], { durationSec: 60 }),
      item('Приседания без веса', ['knee', 'hip'], { reps: 15 }),
      item('Ягодичный мостик', ['back', 'hip'], { reps: 15 }),
      item('Лёгкий подход первого упражнения', [], { durationSec: 60 }, 'Вес вполовину рабочего'),
    ],
  },
  {
    name: 'Разминка перед верхом',
    focus: 'upper',
    items: [
      item('Лёгкое кардио: эллипс или гребной тренажёр', [], { durationSec: 180 }),
      item('Круги плечами', ['shoulder'], { durationSec: 45 }),
      item('Махи руками вперёд и в стороны', ['shoulder'], { durationSec: 45 }),
      item('Кошка-корова', ['back'], { durationSec: 45 }),
      item('Отжимания от стены', ['shoulder', 'elbow', 'wrist'], { reps: 12 }),
      item('Лёгкий подход первого упражнения', [], { durationSec: 60 }, 'Вес вполовину рабочего'),
    ],
  },
  {
    name: 'Разминка на всё тело',
    focus: 'full',
    items: [
      item('Лёгкое кардио на любом тренажёре', [], { durationSec: 180 }),
      item('Круги суставами: шея, плечи, таз', ['neck', 'shoulder', 'hip'], { durationSec: 60 }),
      item('Кошка-корова', ['back'], { durationSec: 45 }),
      item('Приседания без веса', ['knee', 'hip'], { reps: 12 }),
      item('Лёгкий подход первого упражнения', [], { durationSec: 60 }, 'Вес вполовину рабочего'),
    ],
  },
]

const itemSchema = z
  .object({
    title: z.string().trim().min(1, 'Назови пункт').max(80),
    exerciseId: z.string().uuid().nullable().default(null),
    durationSec: z.number().int().min(5).max(900).nullable(),
    reps: z.number().int().min(1).max(100).nullable(),
    note: z.string().trim().max(200).nullable().default(null),
    zones: z.array(z.string().max(30)).max(10).default([]),
  })
  .refine((value) => value.durationSec !== null || value.reps !== null, {
    message: 'У пункта должно быть время или повторения',
  })

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Назови шаблон').max(60),
  focus: z.enum(['legs', 'upper', 'full']),
  items: z.array(itemSchema).max(20),
})

export type WarmupTemplateInput = z.input<typeof templateSchema>

/** Первый вход в зал: создаём три шаблона, но только если их никогда не было (архивные считаются). */
async function ensureDefaultWarmups(gymId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'warmups:' + gymId}))`)
    const [existing] = await tx
      .select({ id: warmupTemplates.id })
      .from(warmupTemplates)
      .where(eq(warmupTemplates.gymId, gymId))
      .limit(1)
    if (existing) return
    await tx.insert(warmupTemplates).values(DEFAULT_WARMUPS.map((template) => ({ gymId, ...template })))
  })
}

export async function listWarmupTemplates(gymId: string): Promise<WarmupTemplate[]> {
  await ensureDefaultWarmups(gymId)
  return db
    .select()
    .from(warmupTemplates)
    .where(and(eq(warmupTemplates.gymId, gymId), isNull(warmupTemplates.archivedAt)))
    .orderBy(asc(warmupTemplates.createdAt), asc(warmupTemplates.name))
}

/** Шаблон под тип дня; нет такого — шаблон «всё тело». */
export async function getWarmupFor(gymId: string, focus: WarmupFocus): Promise<WarmupTemplate | null> {
  const all = await listWarmupTemplates(gymId)
  return all.find((t) => t.focus === focus) ?? all.find((t) => t.focus === 'full') ?? all[0] ?? null
}

/** Шаблоны разминки — контент зала, как каталог: правит тот, у кого есть `catalog.edit`. */
export async function saveWarmupTemplate(
  actor: Actor,
  input: WarmupTemplateInput,
): Promise<WarmupTemplate> {
  assertCan(actor, 'catalog.edit')
  const data = templateSchema.parse(input)

  if (data.id) {
    const [row] = await db
      .update(warmupTemplates)
      .set({ name: data.name, focus: data.focus, items: data.items, updatedAt: new Date() })
      .where(and(eq(warmupTemplates.id, data.id), eq(warmupTemplates.gymId, actor.gymId)))
      .returning()
    if (!row) throw new Error('Шаблон не найден')
    return row
  }

  const [row] = await db
    .insert(warmupTemplates)
    .values({ gymId: actor.gymId, name: data.name, focus: data.focus, items: data.items })
    .returning()
  return row!
}

/** Ничего не удаляем насовсем: шаблон уходит в архив. */
export async function archiveWarmupTemplate(actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'catalog.edit')
  await db
    .update(warmupTemplates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(warmupTemplates.id, id), eq(warmupTemplates.gymId, actor.gymId)))
}
