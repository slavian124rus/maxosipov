export type MuscleView = 'front' | 'back'

export type MuscleDefinition = {
  code: string
  nameRu: string
  view: MuscleView
}

/**
 * Справочник мышц — DESIGN.md §6.3. Коды фиксированы: совпадают с `muscles.code`
 * и с id слоёв SVG-фигуры (`m-<code>`).
 */
export const MUSCLES = [
  // Спереди — 15
  { code: 'neck', nameRu: 'Шея', view: 'front' },
  { code: 'traps-upper', nameRu: 'Верх трапеций', view: 'front' },
  { code: 'delts-front', nameRu: 'Передние дельты', view: 'front' },
  { code: 'delts-side', nameRu: 'Средние дельты', view: 'front' },
  { code: 'chest', nameRu: 'Грудные', view: 'front' },
  { code: 'biceps', nameRu: 'Бицепс', view: 'front' },
  { code: 'brachialis', nameRu: 'Плечевая мышца', view: 'front' },
  { code: 'forearms-flexors', nameRu: 'Сгибатели предплечья', view: 'front' },
  { code: 'serratus', nameRu: 'Передняя зубчатая', view: 'front' },
  { code: 'abs', nameRu: 'Пресс', view: 'front' },
  { code: 'obliques', nameRu: 'Косые мышцы живота', view: 'front' },
  { code: 'hip-flexors', nameRu: 'Сгибатели бедра', view: 'front' },
  { code: 'adductors', nameRu: 'Приводящие бедра', view: 'front' },
  { code: 'quads', nameRu: 'Квадрицепсы', view: 'front' },
  { code: 'tibialis', nameRu: 'Передняя большеберцовая', view: 'front' },
  // Сзади — 12
  { code: 'traps-middle', nameRu: 'Средняя часть трапеций', view: 'back' },
  { code: 'delts-rear', nameRu: 'Задние дельты', view: 'back' },
  { code: 'rhomboids', nameRu: 'Ромбовидные', view: 'back' },
  { code: 'lats', nameRu: 'Широчайшие', view: 'back' },
  { code: 'teres', nameRu: 'Большая круглая', view: 'back' },
  { code: 'triceps', nameRu: 'Трицепс', view: 'back' },
  { code: 'forearms-extensors', nameRu: 'Разгибатели предплечья', view: 'back' },
  { code: 'lower-back', nameRu: 'Разгибатели спины', view: 'back' },
  { code: 'glutes', nameRu: 'Ягодичные', view: 'back' },
  { code: 'glutes-medius', nameRu: 'Средняя ягодичная', view: 'back' },
  { code: 'hamstrings', nameRu: 'Бицепс бедра', view: 'back' },
  { code: 'calves', nameRu: 'Икры', view: 'back' },
] as const satisfies readonly MuscleDefinition[]

export type MuscleCode = (typeof MUSCLES)[number]['code']

/** Id слоя SVG для кода мышцы (`m-lats`). */
export function svgLayerId(code: MuscleCode): string {
  return `m-${code}`
}

/** Название мышцы для интерфейса. Неизвестный код возвращаем как есть. */
export function muscleName(code: string): string {
  return MUSCLES.find((muscle) => muscle.code === code)?.nameRu ?? code
}

/** Сторона фигуры, к которой относится мышца (для фильтров и `defaultView`). */
export function muscleView(code: string): MuscleView | null {
  return MUSCLES.find((muscle) => muscle.code === code)?.view ?? null
}

/** Проверка, что строка — известный код мышцы. */
export function isMuscleCode(value: string): value is MuscleCode {
  return MUSCLES.some((muscle) => muscle.code === value)
}
