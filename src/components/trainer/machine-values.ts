/**
 * Значения формы тренажёра: шаг веса приходит строкой из `<input>` и уходит числом в БД.
 * Чистые функции — покрыты тестами (`machine-values.test.ts`).
 */

/** «2,5» и «2.5» → 2.5; пустая строка → 5 кг (шаг по умолчанию); «0» → без веса; мусор → NaN. */
export function parseWeightStep(value: string): number {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return 5

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** Шаг веса для поля: 2.5 → «2,5» (DESIGN.md §9.2 — с запятой). */
export function formatStep(value: number): string {
  return String(value).replace('.', ',')
}

/** «Без веса»: кардио и всё, где клиент не прибавляет блины. */
export function isNoWeight(value: number): boolean {
  return value <= 0
}
