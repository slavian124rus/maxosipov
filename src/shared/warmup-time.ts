const SECONDS_PER_REP = 3

/** Время разминки в секундах: у пункта либо длительность, либо повторения (по 3 с). */
export function warmupSeconds(items: { durationSec: number | null; reps: number | null }[]): number {
  return items.reduce(
    (sum, item) => sum + (item.durationSec ?? (item.reps ? item.reps * SECONDS_PER_REP : 0)),
    0,
  )
}
