import { and, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { aiMessages } from './schema'

/** Зоны тела, которые код выделяет из жалобы клиента. `general` — жалоба без названной части тела. */
export type PainZone =
  | 'back'
  | 'knee'
  | 'shoulder'
  | 'elbow'
  | 'neck'
  | 'wrist'
  | 'hip'
  | 'foot'
  | 'chest'
  | 'general'

export const PAIN_ZONE_LABELS: Record<PainZone, string> = {
  back: 'спина / поясница',
  knee: 'колено',
  shoulder: 'плечо',
  elbow: 'локоть',
  neck: 'шея',
  wrist: 'запястье / кисть',
  hip: 'бедро / ягодицы',
  foot: 'голень / стопа',
  chest: 'грудь',
  general: 'самочувствие',
}

const ZONE_ROOTS: [PainZone, string[]][] = [
  ['back', ['спина', 'спину', 'спине', 'спины', 'поясниц']],
  ['knee', ['колен']],
  ['shoulder', ['плеч']],
  ['elbow', ['локот', 'локт']],
  ['neck', ['шея', 'шеи', 'шею']],
  ['wrist', ['запяст', 'кист']],
  ['hip', ['бедр', 'ягодиц']],
  ['foot', ['голен', 'стоп']],
  ['chest', ['грудь', 'груди']],
]

/** Какие мышцы каталога нагружает больная зона (коды — из DESIGN.md §6.3). */
export const ZONE_MUSCLES: Record<PainZone, string[]> = {
  back: ['lats', 'lower-back', 'rhomboids', 'teres', 'traps-middle', 'traps-upper'],
  knee: ['quads', 'hamstrings', 'calves', 'tibialis', 'adductors'],
  shoulder: ['delts-front', 'delts-side', 'delts-rear', 'traps-upper', 'chest'],
  elbow: ['biceps', 'brachialis', 'triceps', 'forearms-flexors', 'forearms-extensors'],
  neck: ['neck', 'traps-upper'],
  wrist: ['forearms-flexors', 'forearms-extensors'],
  hip: ['glutes', 'glutes-medius', 'hamstrings', 'hip-flexors', 'adductors'],
  foot: ['calves', 'tibialis'],
  chest: ['chest', 'serratus'],
  general: [],
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}

/** Зоны жалобы по словам клиента; без частей тела — `general`. */
export function painZones(text: string): PainZone[] {
  const normalized = normalize(text)
  const zones = ZONE_ROOTS.filter(([, roots]) => roots.some((root) => normalized.includes(root))).map(
    ([zone]) => zone,
  )

  return zones.length > 0 ? zones : ['general']
}

/** Сообщение клиента о том, что боль прошла или Максим уже посмотрел. */
const CLEARANCE =
  /(^|[^а-я])(прошло|прошла|не болит|уже не болит|разобрал(ся|ись|и)?|посмотрел(а)?|все ок|все хорошо|разрешил(а)?|максим сказал|максим разрешил)([^а-я]|$)/

export function mentionsClearance(text: string): boolean {
  return CLEARANCE.test(normalize(text))
}

export type PainState = {
  /** Открытые (не разобранные Максимом) жалобы за окно. */
  zones: PainZone[]
  complaints: { text: string; at: Date }[]
  /** Что Максим велел или разрешил при разборе. */
  notes: string[]
  /** Недавно разобранные зоны — для подавления ложных срабатываний. */
  recentlyResolved: PainZone[]
}

export const OPEN_WINDOW_DAYS = 14
export const CLEARANCE_WINDOW_DAYS = 7

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000)
}

/** Состояние боли клиента: открытые жалобы, заметки Максима, недавние разборы. */
export async function loadPainState(userId: string, now = new Date()): Promise<PainState> {
  const open = await db
    .select({ content: aiMessages.content, createdAt: aiMessages.createdAt })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, 'user'),
        isNotNull(aiMessages.flagged),
        isNull(aiMessages.resolvedAt),
        gte(aiMessages.createdAt, daysAgo(now, OPEN_WINDOW_DAYS)),
      ),
    )
    .orderBy(desc(aiMessages.createdAt))

  const resolved = await db
    .select({
      content: aiMessages.content,
      note: aiMessages.resolutionNote,
    })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, 'user'),
        isNotNull(aiMessages.flagged),
        isNotNull(aiMessages.resolvedAt),
        gte(aiMessages.resolvedAt, daysAgo(now, CLEARANCE_WINDOW_DAYS)),
      ),
    )

  return {
    zones: [...new Set(open.flatMap((row) => painZones(row.content)))],
    complaints: open.map((row) => ({ text: row.content, at: row.createdAt })),
    notes: resolved.map((row) => row.note).filter((note): note is string => !!note?.trim()),
    recentlyResolved: [...new Set(resolved.flatMap((row) => painZones(row.content)))],
  }
}

/** Новая жалоба по зонам, по которым уже есть открытая, Максиму повторно не уходит. */
export function isRepeatComplaint(state: PainState, zones: PainZone[]): boolean {
  return zones.every((zone) => state.zones.includes(zone))
}

/** Блок для системной инструкции: что нельзя и что можно, пока жалоба открыта. */
export function buildPainBlock(state: PainState): string {
  const lines: string[] = []

  if (state.zones.length > 0) {
    const labels = state.zones.map((zone) => PAIN_ZONE_LABELS[zone]).join(', ')
    lines.push(
      `Открытая жалоба клиента: ${labels}. Максим ещё не разобрался. Не давай медицинских советов и не ставь диагнозов. ` +
        'Не нагружай эту зону и не повышай нагрузку. Можно: убрать упражнение, заменить на щадящее вне этой зоны, снизить вес или подходы. ' +
        'Нельзя: добавлять нагрузку на больную зону. Код отклонит такие изменения.',
    )
  }

  if (state.notes.length > 0) {
    lines.push(`Максим разобрал жалобу и написал: ${state.notes.join(' / ')}.`)
  }

  return lines.join('\n')
}

type Violation = string

type SafetyTree = {
  days: { exercises: { id: string; exerciseId: string; sets: number; repMax: number; targetWeightKg: number | null }[] }[]
}

type SafetyOp =
  | { op: 'add_exercise' | 'replace_exercise'; exerciseId: string; programExerciseId?: string }
  | { op: 'set_target_weight'; programExerciseId: string; weightKg: number | null }
  | { op: 'set_sets_reps'; programExerciseId: string; sets?: number; repMax?: number }
  | { op: string }

function hitsZone(muscles: string[], state: Pick<PainState, 'zones'>): boolean {
  const banned = new Set(state.zones.flatMap((zone) => ZONE_MUSCLES[zone]))
  return muscles.some((muscle) => banned.has(muscle))
}

/**
 * Проверка, что изменение не добавляет нагрузку на больную зону.
 * Удаление, замена на упражнение вне зоны и снижение нагрузки разрешены.
 * Возвращает текст ошибки для модели или `null`.
 */
export function checkPainSafety(
  ops: SafetyOp[],
  tree: SafetyTree | null,
  state: Pick<PainState, 'zones'>,
  musclesOf: (exerciseId: string) => string[],
): Violation | null {
  if (state.zones.length === 0) return null

  const items = new Map(
    (tree?.days ?? []).flatMap((day) => day.exercises.map((item) => [item.id, item] as const)),
  )

  const bad = 'У клиента открытая жалоба на боль: нельзя добавлять нагрузку на эту зону. Предложи убрать, заменить на щадящее упражнение вне зоны или снизить нагрузку.'

  for (const op of ops) {
    if (op.op === 'add_exercise' || op.op === 'replace_exercise') {
      const { exerciseId } = op as { exerciseId: string }
      if (hitsZone(musclesOf(exerciseId), state)) return bad
    }

    if (op.op === 'set_target_weight') {
      const { programExerciseId, weightKg } = op as { programExerciseId: string; weightKg: number | null }
      const item = items.get(programExerciseId)
      if (item && weightKg !== null && weightKg > (item.targetWeightKg ?? 0)) {
        if (state.zones.includes('general') || hitsZone(musclesOf(item.exerciseId), state)) return bad
      }
    }

    if (op.op === 'set_sets_reps') {
      const { programExerciseId, sets, repMax } = op as {
        programExerciseId: string
        sets?: number
        repMax?: number
      }
      const item = items.get(programExerciseId)
      const raises =
        item !== undefined &&
        ((sets !== undefined && sets > item.sets) || (repMax !== undefined && repMax > item.repMax))
      if (item && raises) {
        if (state.zones.includes('general') || hitsZone(musclesOf(item.exerciseId), state)) return bad
      }
    }
  }

  return null
}

/** Черновик новой программы: ни одного упражнения на больную зону. */
export function checkDraftPainSafety(
  exerciseIds: string[],
  state: Pick<PainState, 'zones'>,
  musclesOf: (exerciseId: string) => string[],
): Violation | null {
  if (state.zones.length === 0) return null

  const hit = exerciseIds.some((id) => hitsZone(musclesOf(id), state))
  return hit
    ? 'У клиента открытая жалоба на боль: в новую программу нельзя включать упражнения, нагружающие эту зону.'
    : null
}
