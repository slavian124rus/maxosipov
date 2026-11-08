import type { Recommendation } from './types'

const NBSP = '\u00A0'

/** Вес в текстах: «35 кг», «32,5 кг» (запятая и неразрывный пробел, DESIGN.md §9.2). */
export function formatWeight(weightKg: number): string {
  const text = Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1).replace('.', ',')
  return `${text}${NBSP}кг`
}

/** Короткий текст подсказки по `reasonCode` (DESIGN.md §9.2). */
export function recommendationText(
  recommendation: Recommendation,
  options: { repMax: number },
): string {
  const weight = recommendation.weightKg === null ? '' : formatWeight(recommendation.weightKg)

  switch (recommendation.reasonCode) {
    case 'increase_streak':
      return `Сегодня ${weight} — две тренировки подряд все подходы сделаны`
    case 'increase_easy':
      return `Сегодня ${weight} — в прошлый раз все подходы были легко`
    case 'keep':
      return `Оставляем ${weight} — добиваем ${options.repMax} повторений во всех подходах`
    case 'decrease':
      return `Сегодня ${weight} — восстановим технику и вернёмся`
    default:
      return 'Подбери рабочий вес: 10–12 повторений с запасом 2'
  }
}