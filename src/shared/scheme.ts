/** Отдых в схеме: «1:30». */
export function formatRest(restSec: number): string {
  const minutes = Math.floor(restSec / 60)
  const seconds = restSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** «3 подхода · 10–12 раз» / «3 подхода · 10 раз · отдых 1:30» (DESIGN.md §9.2). */
export function formatScheme(
  setsCount: number,
  repMin: number,
  repMax: number,
  restSec?: number,
): string {
  const repsText = repMin === repMax ? `${repMin} раз` : `${repMin}–${repMax} раз`
  const rest = restSec && restSec > 0 ? ` · отдых ${formatRest(restSec)}` : ''
  return `${setsCount} подхода · ${repsText}${rest}`
}

/** «≈ 55 мин»; для 0 — пустая строка. */
export function formatDuration(minutes: number): string {
  return minutes > 0 ? `≈ ${minutes} мин` : ''
}
