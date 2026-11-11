/**
 * Русские склонения по числу (DESIGN.md §9.2): «1 упражнение», «2 упражнения», «5 упражнений».
 * Формы: [одно, два-четыре, много].
 */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(count) % 100
  const ones = abs % 10

  if (abs > 10 && abs < 20) return forms[2]
  if (ones > 1 && ones < 5) return forms[1]
  if (ones === 1) return forms[0]
  return forms[2]
}

/** «4 упражнения» — подпись счётчика в дереве и таблицах. */
export function exercisesLabel(count: number): string {
  return `${count} ${pluralRu(count, ['упражнение', 'упражнения', 'упражнений'])}`
}

/** «3 клиента» — для заголовков списков. */
export function clientsLabel(count: number): string {
  return `${count} ${pluralRu(count, ['клиент', 'клиента', 'клиентов'])}`
}

/** «2 машины» / «1 тренажёр» — для дерева тренажёров. */
export function machinesLabel(count: number): string {
  return `${count} ${pluralRu(count, ['тренажёр', 'тренажёра', 'тренажёров'])}`
}
