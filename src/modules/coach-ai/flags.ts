export type PainFlag = 'pain' | 'injury'

/** Дословный ответ на боль или травму (ARCHITECTURE.md §9.5, DESIGN.md §9.3). */
export const PAIN_REPLY = 'Остановись. Это лучше показать Максиму — я ему передал.'

const INJURY_ROOTS = [
  'травм',
  'растяж',
  'надорв',
  'порвал',
  'вывих',
  'перелом',
  'защемил',
  'защемлен',
]

/** Названия частей тела: нужны для «тянет» и для отсечения мышечной усталости. */
const BODY_PARTS = [
  'спина',
  'спину',
  'спине',
  'поясниц',
  'колен',
  'плеч',
  'локот',
  'локт',
  'шея',
  'шеи',
  'шею',
  'запяст',
  'кист',
  'бедр',
  'голен',
  'стоп',
  'ягодиц',
  'грудь',
  'груди',
]

const PAIN_PATTERNS = [
  /(^|[^а-я])бол(ит|ят|ел|ела|ело|ь|ьно)([^а-я]|$)/,
  /(^|[^а-я])ноет([^а-я]|$)/,
  /(^|[^а-я])ныть([^а-я]|$)/,
  /(^|[^а-я])хрустит/,
  /(^|[^а-я])щелкает/,
  /(^|[^а-я])онемел/,
  /(^|[^а-я])простре/,
  /(^|[^а-я])кольнуло/,
]

const SORENESS = /крепатур|забил(ись|ась|ся|ась)?\s+мышц/
const AFTER_WORKOUT = /после\s+тренировк/

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}

function hasBodyPart(text: string): boolean {
  return BODY_PARTS.some((part) => text.includes(part))
}

function hasPainWord(text: string): boolean {
  return PAIN_PATTERNS.some((pattern) => pattern.test(text))
}

function isTensionAboutBody(text: string): boolean {
  return /(^|[^а-я])(по)?тян[а-я]*/.test(text) && hasBodyPart(text)
}

/**
 * Флаги боли и травмы определяет код, а не модель.
 * Обычная мышечная усталость (крепатура, «болят мышцы после тренировки») — не флаг.
 */
export function detectFlag(text: string): PainFlag | null {
  const normalized = normalize(text)

  if (INJURY_ROOTS.some((root) => normalized.includes(root))) return 'injury'

  const pain = hasPainWord(normalized) || isTensionAboutBody(normalized)
  if (!pain) return null

  const sorenessOnly =
    (SORENESS.test(normalized) || AFTER_WORKOUT.test(normalized)) && !hasBodyPart(normalized)

  return sorenessOnly ? null : 'pain'
}