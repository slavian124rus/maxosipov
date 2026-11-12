import { expect, test } from 'vitest'
import { reviewTemplate, type ReviewDay } from './template-review'
import type { TemplateCatalogItem } from './template-draft'

const CATALOG: TemplateCatalogItem[] = [
  { id: 'quads', name: 'Гакк-приседания', zone: 'Ноги', machine: 'Гакк', primary: ['quads'] },
  { id: 'lats', name: 'Тяга блока', zone: 'Спина', machine: 'Блок', primary: ['lats'] },
  { id: 'biceps', name: 'Сгибания', zone: 'Руки', machine: 'Парта', primary: ['biceps'] },
  { id: 'abs', name: 'Скручивания', zone: 'Пресс', machine: null, primary: ['abs'] },
]

function day(name: string, ids: string[], overrides: Record<string, Partial<ReviewDay['exercises'][number]>> = {}): ReviewDay {
  return {
    name,
    exercises: ids.map((exerciseId) => ({
      exerciseId,
      sets: 3,
      repMin: 10,
      repMax: 12,
      restSec: 90,
      ...overrides[exerciseId],
    })),
  }
}

test('ровный день без замечаний', () => {
  expect(reviewTemplate([day('Ноги', ['quads', 'abs'])], CATALOG)).toEqual([])
})

test('день без упражнений — ошибка', () => {
  const issues = reviewTemplate([day('Пусто', [])], CATALOG)

  expect(issues).toEqual([{ day: 'Пусто', text: 'в дне нет упражнений', severity: 'error' }])
})

test('повтор упражнения в дне — ошибка', () => {
  const issues = reviewTemplate([day('Ноги', ['quads', 'quads'])], CATALOG)

  expect(issues.some((item) => item.severity === 'error' && item.text.includes('повторяется'))).toBe(
    true,
  )
})

test('повторений от больше, чем до — ошибка', () => {
  const issues = reviewTemplate(
    [day('Ноги', ['quads'], { quads: { repMin: 15, repMax: 8 } })],
    CATALOG,
  )

  expect(issues.some((item) => item.severity === 'error' && item.text.includes('больше, чем до'))).toBe(
    true,
  )
})

test('подходы и отдых вне разумных границ — предупреждения', () => {
  const issues = reviewTemplate(
    [day('Ноги', ['quads'], { quads: { sets: 1, restSec: 10 } })],
    CATALOG,
  )
  const texts = issues.map((item) => item.text)

  expect(texts.some((text) => text.includes('1 подходов'))).toBe(true)
  expect(texts.some((text) => text.includes('отдых 10 с'))).toBe(true)
  expect(issues.every((item) => item.severity === 'warning')).toBe(true)
})

test('все упражнения на одну мышцу — предупреждение', () => {
  const catalog: TemplateCatalogItem[] = [
    ...CATALOG,
    { id: 'biceps2', name: 'Молотки', zone: 'Руки', machine: null, primary: ['biceps'] },
  ]

  const issues = reviewTemplate([day('Руки', ['biceps', 'biceps2'])], catalog)

  expect(issues.some((item) => item.text.includes('одну группу'))).toBe(true)
})

test('день без крупных мышц — предупреждение', () => {
  const issues = reviewTemplate([day('Мелкое', ['biceps', 'abs'])], CATALOG)

  expect(issues.some((item) => item.text.includes('крупные мышцы'))).toBe(true)
})

test('много упражнений в дне — предупреждение', () => {
  const catalog: TemplateCatalogItem[] = Array.from({ length: 10 }, (_, index) => ({
    id: `ex-${index}`,
    name: `Упражнение ${index}`,
    zone: index === 0 ? 'Ноги' : 'Руки',
    machine: null,
    primary: index === 0 ? ['quads'] : ['biceps'],
  }))

  const issues = reviewTemplate([day('Длинный', catalog.map((item) => item.id))], catalog)

  expect(issues.some((item) => item.text.includes('день затянется'))).toBe(true)
})
