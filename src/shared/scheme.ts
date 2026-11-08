/** «3 подхода · 10–12 раз» / «3 подхода · 10 раз» (DESIGN.md §9.2). */
export function formatScheme(setsCount: number, repMin: number, repMax: number): string {
  const repsText = repMin === repMax ? `${repMin} раз` : `${repMin}–${repMax} раз`
  return `${setsCount} подхода · ${repsText}`
}