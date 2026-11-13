import { warmupSeconds } from '@/shared/warmup-time'
import type { DayFocus, WarmupItem } from './schema'

export { warmupSeconds }

const LEGS = new Set([
  'quads',
  'hamstrings',
  'calves',
  'glutes',
  'glutes-medius',
  'tibialis',
  'adductors',
  'hip-flexors',
])
const UPPER = new Set([
  'neck',
  'traps-upper',
  'traps-middle',
  'delts-front',
  'delts-side',
  'delts-rear',
  'chest',
  'biceps',
  'brachialis',
  'forearms-flexors',
  'forearms-extensors',
  'serratus',
  'rhomboids',
  'lats',
  'teres',
  'triceps',
])

const MIN_WARMUP_SEC = 300

/**
 * Тип дня для выбора разминки. Заданный тренером главнее; иначе по основным мышцам
 * упражнений: больше половины на ноги — `legs`, больше половины на верх — `upper`.
 * Пресс, кор и поясница не относятся ни к ногам, ни к верху.
 */
export function resolveDayFocus(explicit: DayFocus | null, primaryMuscles: string[][]): DayFocus {
  if (explicit) return explicit
  if (primaryMuscles.length === 0) return 'full'

  let legs = 0
  let upper = 0
  for (const muscles of primaryMuscles) {
    const legCount = muscles.filter((muscle) => LEGS.has(muscle)).length
    const upperCount = muscles.filter((muscle) => UPPER.has(muscle)).length
    if (legCount > upperCount) legs += 1
    else if (upperCount > legCount) upper += 1
  }

  if (legs / primaryMuscles.length > 0.5) return 'legs'
  if (upper / primaryMuscles.length > 0.5) return 'upper'
  return 'full'
}

const touches = (item: WarmupItem, zones: string[]) => item.zones.some((zone) => zones.includes(zone))

/**
 * Подстройка при боли — кодом, без модели: пункты, нагружающие больную зону, убираем,
 * а если разминка стала короче 5 минут, добираем безопасными пунктами из библиотеки.
 */
export function adjustWarmupForPain(
  items: WarmupItem[],
  painZones: string[],
  library: WarmupItem[],
): WarmupItem[] {
  const zones = painZones.filter((zone) => zone !== 'general')
  if (zones.length === 0) return items

  const result = items.filter((item) => !touches(item, zones))
  if (result.length === items.length) return items

  const titles = new Set(result.map((item) => item.title))
  for (const candidate of library) {
    if (warmupSeconds(result) >= MIN_WARMUP_SEC) break
    if (titles.has(candidate.title) || touches(candidate, zones)) continue
    result.push(candidate)
    titles.add(candidate.title)
  }

  return result
}
