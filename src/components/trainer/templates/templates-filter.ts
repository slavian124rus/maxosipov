import {
  AUDIENCE_LABELS,
  GOAL_LABELS,
  type ProgramAudience,
  type TemplateListItem,
} from '@/shared/program-labels'

/** Приводим к нижнему регистру и «ё» → «е» — как в остальных поисках проекта. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}

export type TemplateFilter = {
  query?: string
  audience?: ProgramAudience | 'all'
}

/**
 * Поиск по шаблонам: название, номер («№3» или «3»), цель и аудитория.
 * «жен» находит женские шаблоны, «похуд» — шаблоны похудения.
 */
export function filterTemplates(
  items: TemplateListItem[],
  filter: TemplateFilter = {},
): TemplateListItem[] {
  const needle = normalize(filter.query ?? '')
  const audience = filter.audience ?? 'all'

  return items.filter((item) => {
    if (audience !== 'all' && item.audience !== audience) return false
    if (!needle) return true

    const haystack = [
      item.name,
      item.title,
      item.number ? `№${item.number} ${item.number}` : '',
      item.goal ? GOAL_LABELS[item.goal] : '',
      item.audience ? AUDIENCE_LABELS[item.audience] : '',
    ]
      .join(' ')
      .toLowerCase()
      .replace(/ё/g, 'е')

    return haystack.includes(needle)
  })
}

/** Счётчики для чипов аудитории: «Все 12 · Женские 5 · Мужские 4». */
export function audienceCounts(items: TemplateListItem[]): Record<ProgramAudience | 'all', number> {
  const counts: Record<ProgramAudience | 'all', number> = {
    all: items.length,
    any: 0,
    male: 0,
    female: 0,
  }

  for (const item of items) {
    if (item.audience) counts[item.audience] += 1
  }

  return counts
}
