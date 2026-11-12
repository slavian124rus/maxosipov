/**
 * Подписи шаблонов программ. Живут в `shared`, чтобы их можно было импортировать
 * и в клиентские компоненты: `@/modules/training` тянет БД и `next/headers`.
 */

/** Для кого шаблон: мужчинам, женщинам или всем. `null` — не указано. */
export type ProgramAudience = 'any' | 'male' | 'female'

/** Цель программы — та же четвёрка, что в анкете клиента (`client_profiles.goal`). */
export type ProgramGoal = 'strength' | 'mass' | 'fat_loss' | 'health'

export const AUDIENCE_LABELS: Record<ProgramAudience, string> = {
  any: 'для всех',
  male: 'для мужчин',
  female: 'для женщин',
}

export const GOAL_LABELS: Record<ProgramGoal, string> = {
  strength: 'Сила',
  mass: 'Масса',
  fat_loss: 'Похудение',
  health: 'Здоровье',
}

/** «3 дня», «1 день», «5 дней». */
export function pluralDays(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

/** «Похудение для женщин №3» — так шаблон подписан в списке и в карточке. */
export function templateTitle(input: {
  name: string
  audience: ProgramAudience | null
  number: number | null
}): string {
  const audience = input.audience ? AUDIENCE_LABELS[input.audience] : null
  const suffix = [audience, input.number ? `№${input.number}` : null].filter(Boolean).join(' ')

  return suffix ? `${input.name} ${suffix}` : input.name
}

/** Шаблон в списке «Программы»: готовые подписи и счётчики. */
export type TemplateListItem = {
  id: string
  name: string
  /** Готовое название: «Похудение для женщин №3». */
  title: string
  /** Подпись под названием: «Похудение · 3 дня · 21 упражнение». */
  subtitle: string
  audience: ProgramAudience | null
  goal: ProgramGoal | null
  number: number | null
  days: number
  exercises: number
  updatedAt: Date
}

/** Подпись под названием: цель · сколько дней · сколько упражнений. */
export function templateMeta(input: {
  goal: ProgramGoal | null
  days: number
  exercises: number
}): string {
  const parts = [
    input.goal ? GOAL_LABELS[input.goal] : null,
    `${input.days} ${pluralDays(input.days)}`,
    `${input.exercises} упражнений`,
  ].filter(Boolean)

  return parts.join(' · ')
}
