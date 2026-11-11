import { expect, test } from 'vitest'
import {
  buildExerciseTree,
  buildMachineTree,
  countTreeExercises,
  filterExerciseTree,
  filterMachineTree,
  groupMachinesByZone,
  NO_MACHINE_TITLE,
  NO_ZONE_TITLE,
  normalizeQuery,
  splitMatches,
  type ExerciseTreeItem,
} from './catalog-tree'

function item(
  name: string,
  machine: { id: string; name: string; zone: string | null } | null,
  muscles: string[] = [],
  status: 'draft' | 'published' = 'published',
): ExerciseTreeItem {
  return {
    id: name,
    name,
    status,
    machineId: machine?.id ?? null,
    machineName: machine?.name ?? null,
    machineZone: machine?.zone ?? null,
    muscles,
    videoLabel: 'видео: Готово',
    hasMuscles: false,
  }
}

const LEGS = { id: 'm-legs', name: 'Гакк-машина', zone: 'Ноги' }
const BACK = { id: 'm-back', name: 'Верхний блок', zone: 'Спина' }
const NO_ZONE = { id: 'm-nozone', name: 'Скамья без зоны', zone: null }

const ITEMS = [
  item('Гакк-приседания', LEGS, ['Квадрицепсы']),
  item('Жим ногами', LEGS, ['Квадрицепсы'], 'draft'),
  item('Тяга верхнего блока', BACK, ['Широчайшие']),
  item('Швунг со штангой', null, ['Плечи']),
  item('Гиперэкстензия', NO_ZONE, ['Разгибатели спины']),
]

test('normalizeQuery: регистр, «ё» и пробелы', () => {
  expect(normalizeQuery('  Тяга Ёлка ')).toBe('тяга елка')
})

test('дерево: зона → тренажёр → упражнения, зоны по алфавиту, особые в конце', () => {
  const zones = buildExerciseTree(ITEMS)

  expect(zones.map((zone) => zone.title)).toEqual([
    'Ноги',
    'Спина',
    NO_ZONE_TITLE,
    NO_MACHINE_TITLE,
  ])
  expect(zones.map((zone) => zone.count)).toEqual([2, 1, 1, 1])
  expect(zones[0]?.machines.map((machine) => machine.title)).toEqual(['Гакк-машина'])
  expect(zones[0]?.machines[0]?.exercises.map((exercise) => exercise.name)).toEqual([
    'Гакк-приседания',
    'Жим ногами',
  ])
  expect(countTreeExercises(zones)).toBe(5)
})

test('фильтр по упражнению оставляет только его ветку', () => {
  const zones = filterExerciseTree(buildExerciseTree(ITEMS), 'тяга')

  expect(zones.map((zone) => zone.title)).toEqual(['Спина'])
  expect(zones[0]?.machines[0]?.exercises.map((exercise) => exercise.name)).toEqual([
    'Тяга верхнего блока',
  ])
  expect(countTreeExercises(zones)).toBe(1)
})

test('фильтр работает по «ё» как по «е», ищет по тренажёру и по мышце', () => {
  const zones = buildExerciseTree(ITEMS)

  // «Гакк-машина» → оба упражнения тренажёра, даже если в названии слова нет.
  expect(countTreeExercises(filterExerciseTree(zones, 'гакк'))).toBe(2)
  // Мышца «квадрицепсы» — те же два упражнения.
  expect(countTreeExercises(filterExerciseTree(zones, 'квадрицепс'))).toBe(2)
  // Регистр и «ё» не важны.
  expect(countTreeExercises(filterExerciseTree(zones, 'ШВАРЦ'))).toBe(0)
  expect(countTreeExercises(filterExerciseTree(zones, 'швунг'))).toBe(1)
})

test('фильтр по названию зоны показывает всю зону', () => {
  const zones = filterExerciseTree(buildExerciseTree(ITEMS), 'ноги')

  expect(zones.map((zone) => zone.title)).toEqual(['Ноги'])
  expect(zones[0]?.count).toBe(2)
})

test('пустой запрос возвращает дерево как есть', () => {
  const zones = buildExerciseTree(ITEMS)
  expect(filterExerciseTree(zones, '   ')).toBe(zones)
})

test('фильтр не меняет исходное дерево', () => {
  const zones = buildExerciseTree(ITEMS)
  filterExerciseTree(zones, 'тяга')

  expect(countTreeExercises(zones)).toBe(5)
})

test('группировка тренажёров: зоны по алфавиту, «Без зоны» в конце', () => {
  const groups = groupMachinesByZone([
    { id: '3', name: 'В', zone: 'Спина' },
    { id: '1', name: 'Б', zone: 'Ноги' },
    { id: '2', name: 'А', zone: 'Ноги' },
    { id: '4', name: 'Г', zone: '  ' },
  ])

  expect(groups.map((group) => group.title)).toEqual(['Ноги', 'Спина', NO_ZONE_TITLE])
  expect(groups[0]?.machines.map((machine) => machine.name)).toEqual(['А', 'Б'])
  expect(groups[2]?.pinned).toBe(true)
})

test('дерево тренажёров считает упражнения в зоне и фильтруется', () => {
  const machines = [
    { id: 'm-legs', name: 'Гакк-машина', zone: 'Ноги', weightStepKg: 5, exerciseCount: 2 },
    { id: 'm-back', name: 'Верхний блок', zone: 'Спина', weightStepKg: 2.5, exerciseCount: 3 },
  ]

  const zones = buildMachineTree(machines)
  expect(zones.map((zone) => [zone.title, zone.count])).toEqual([
    ['Ноги', 2],
    ['Спина', 3],
  ])

  const filtered = filterMachineTree(zones, 'блок')
  expect(filtered.map((zone) => zone.title)).toEqual(['Спина'])
  expect(filtered[0]?.count).toBe(3)

  expect(filterMachineTree(zones, 'гантель')).toEqual([])
})

test('splitMatches: подсвечивает все вхождения без учёта регистра и «ё»', () => {
  expect(splitMatches('Тяга верхнего блока', 'тяга')).toEqual([
    { text: 'Тяга', hit: true },
    { text: ' верхнего блока', hit: false },
  ])
  expect(splitMatches('Подъём на носки', 'подъем')).toEqual([
    { text: 'Подъём', hit: true },
    { text: ' на носки', hit: false },
  ])
  expect(splitMatches('аба', 'а')).toEqual([
    { text: 'а', hit: true },
    { text: 'б', hit: false },
    { text: 'а', hit: true },
  ])
  expect(splitMatches('Жим', '')).toEqual([{ text: 'Жим', hit: false }])
  expect(splitMatches('Жим', 'тяга')).toEqual([{ text: 'Жим', hit: false }])
})

test('splitMatches не теряет текст: склейка кусков равна исходной строке', () => {
  const text = 'Тяга Ёлка тяга вверх'
  expect(
    splitMatches(text, 'тяга')
      .map((part) => part.text)
      .join(''),
  ).toBe(text)
})
