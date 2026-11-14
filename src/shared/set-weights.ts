/**
 * План «по подходам»: 1-й подход 15 кг, остальные по 20. Прогрессия считает по рабочему
 * (максимальному) весу, поэтому при новом рабочем весе рисунок плана сдвигается целиком.
 */
export function alignSetWeights(plan: number[] | null | undefined, workingWeightKg: number): number[] | null {
  if (!plan || plan.length === 0) return null
  const delta = workingWeightKg - Math.max(...plan)
  return plan.map((weight) => Math.max(0, Math.round((weight + delta) * 100) / 100))
}

/** Вес, который подставляется в подход: из плана по его номеру, иначе как раньше. */
export function initialSetWeight(
  plan: number[] | null | undefined,
  doneCount: number,
  lastWeightKg: number | null,
  startWeightKg: number,
): number {
  if (plan && plan.length > 0) return plan[Math.min(doneCount, plan.length - 1)]!
  return lastWeightKg ?? startWeightKg
}

/** «15 · 20 · 20 кг» для подписи плана. */
export function setWeightsLabel(plan: number[]): string {
  const text = plan.map((weight) => String(weight).replace('.', ',')).join(' · ')
  return `${text} кг`
}
