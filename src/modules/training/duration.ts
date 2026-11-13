export type DurationDay = {
  exercises: { sets: number; repMin: number; repMax: number; restSec: number }[]
}

const SECONDS_PER_REP = 3
const TRANSITION_SEC = 60
const ROUND_TO_MIN = 5

/** Примерное время дня в минутах, округлённое до 5. Пустой день без разминки — 0. */
export function estimateDayMinutes(day: DurationDay, options: { warmupMin?: number } = {}): number {
  const warmupMin = options.warmupMin ?? 0
  if (day.exercises.length === 0 && warmupMin === 0) return 0

  let seconds = 0
  for (const item of day.exercises) {
    const reps = (item.repMin + item.repMax) / 2
    seconds += item.sets * reps * SECONDS_PER_REP
    seconds += Math.max(item.sets - 1, 0) * item.restSec
    seconds += TRANSITION_SEC
  }

  const minutes = seconds / 60 + warmupMin
  return Math.max(ROUND_TO_MIN, Math.round(minutes / ROUND_TO_MIN) * ROUND_TO_MIN)
}
