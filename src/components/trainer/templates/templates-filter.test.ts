import { expect, test } from 'vitest'
import { audienceCounts, filterTemplates } from './templates-filter'
import type { TemplateListItem } from '@/modules/training'

function template(
  name: string,
  number: number,
  audience: 'any' | 'male' | 'female' | null,
  goal: 'strength' | 'mass' | 'fat_loss' | 'health' | null = 'fat_loss',
): TemplateListItem {
  return {
    id: `${name}-${number}`,
    name,
    title: `${name} №${number}`,
    subtitle: '',
    audience,
    goal,
    number,
    days: 3,
    exercises: 15,
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  }
}

const ITEMS: TemplateListItem[] = [
  template('Похудение', 1, 'female'),
  template('Масса', 2, 'male', 'mass'),
  template('Старт', 3, 'any', 'health'),
  template('Сила', 4, null, 'strength'),
]

test('поиск по названию без учёта регистра и «ё»', () => {
  expect(filterTemplates(ITEMS, { query: 'ПОХУД' }).map((item) => item.number)).toEqual([1])
  expect(filterTemplates(ITEMS, { query: '  сила ' }).map((item) => item.number)).toEqual([4])
})

test('поиск по номеру шаблона: «№2» и «2»', () => {
  expect(filterTemplates(ITEMS, { query: '№2' }).map((item) => item.number)).toEqual([2])
  expect(filterTemplates(ITEMS, { query: '3' }).map((item) => item.number)).toEqual([3])
})

test('поиск по цели и по полу', () => {
  expect(filterTemplates(ITEMS, { query: 'масса' }).map((item) => item.number)).toEqual([2])
  expect(filterTemplates(ITEMS, { query: 'жен' }).map((item) => item.number)).toEqual([1])
  expect(filterTemplates(ITEMS, { query: 'муж' }).map((item) => item.number)).toEqual([2])
})

test('чип аудитории фильтрует и складывается с поиском', () => {
  expect(filterTemplates(ITEMS, { audience: 'female' }).map((item) => item.number)).toEqual([1])
  expect(filterTemplates(ITEMS, { audience: 'any' }).map((item) => item.number)).toEqual([3])
  expect(filterTemplates(ITEMS, { audience: 'female', query: 'масса' })).toEqual([])
})

test('пустой запрос и «все» возвращают всё', () => {
  expect(filterTemplates(ITEMS)).toHaveLength(4)
  expect(filterTemplates(ITEMS, { query: '   ', audience: 'all' })).toHaveLength(4)
})

test('audienceCounts: всего и по каждой аудитории', () => {
  expect(audienceCounts(ITEMS)).toEqual({ all: 4, any: 1, male: 1, female: 1 })
})
