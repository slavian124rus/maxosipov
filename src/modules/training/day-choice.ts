/** День программы в объёме, нужном для выбора: id и название. */
export type DayChoice = { id: string; name: string }

/**
 * Какой день тренировать (DESIGN.md §8.1).
 *
 * Приоритет: день, который клиент выбрал сам (`?day=`), затем следующий по порядку
 * программы после последней завершённой тренировки, иначе первый день.
 *
 * Выбор приходит из адреса, поэтому его нельзя доверять: чужой или устаревший id
 * (день удалили, программу сменили) молча откатывается к обычному порядку, а не роняет экран.
 */
export function pickWorkoutDay<T extends DayChoice>(
  days: readonly T[],
  lastDayId: string | null,
  requestedId?: string | null,
): T | null {
  if (days.length === 0) return null

  if (requestedId) {
    const requested = days.find((day) => day.id === requestedId)
    if (requested) return requested
  }

  const lastIndex = days.findIndex((day) => day.id === lastDayId)
  return days[(lastIndex + 1) % days.length] ?? days[0] ?? null
}
