// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MachineTree } from './machine-tree'
import type { MachineTreeItem } from './catalog-tree'

const MACHINES: MachineTreeItem[] = [
  { id: 'm1', name: 'Гакк-машина', zone: 'Ноги', weightStepKg: 5, exerciseCount: 2 },
  { id: 'm2', name: 'Жим ногами 45°', zone: 'Ноги', weightStepKg: 5, exerciseCount: 0 },
  { id: 'm3', name: 'Верхний блок', zone: 'Спина', weightStepKg: 2.5, exerciseCount: 3 },
  { id: 'm4', name: 'Скамья без зоны', zone: null, weightStepKg: 5, exerciseCount: 1 },
]

afterEach(cleanup)

test('дерево: зоны по алфавиту, «Без зоны» в конце, внутри — тренажёры', () => {
  render(<MachineTree machines={MACHINES} />)

  expect(screen.getByText('Всего тренажёров: 4')).toBeTruthy()

  const zones = screen.getAllByRole('button').filter((button) => button.getAttribute('aria-expanded'))
  expect(zones.map((zone) => zone.textContent)).toEqual(['Ноги2', 'Спина1', 'Без зоны1'])

  // Зоны раскрыты: тренажёры видны сразу, с шагом веса и числом упражнений.
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
  expect(screen.getByText('шаг 5 кг · 2 в каталоге')).toBeTruthy()
  expect(screen.getByText('шаг 2,5 кг · 3 в каталоге')).toBeTruthy()
  expect(screen.getByText('шаг 5 кг · в каталоге пока нет')).toBeTruthy()
})

test('зона сворачивается и раскрывается', () => {
  render(<MachineTree machines={MACHINES} />)

  const legs = screen.getByRole('button', { name: /^Ноги/ })
  fireEvent.click(legs)

  expect(legs.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('Гакк-машина')).toBeNull()

  fireEvent.click(legs)
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
})

test('поиск оставляет только подходящие тренажёры и зоны', () => {
  const { container } = render(<MachineTree machines={MACHINES} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), { target: { value: 'блок' } })

  expect(screen.getByText('Найдено тренажёров: 1')).toBeTruthy()
  expect(container.querySelector('mark')?.textContent).toBe('блок')
  // Подсветка режет имя на части, поэтому смотрим весь текст дерева.
  expect(container.textContent).toContain('Верхний блок')
  expect(screen.queryByText('Гакк-машина')).toBeNull()
})

test('поиск по названию зоны показывает все её тренажёры', () => {
  render(<MachineTree machines={MACHINES} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), { target: { value: 'НОГИ' } })

  expect(screen.getByText('Найдено тренажёров: 2')).toBeTruthy()
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
  expect(screen.getByText('Жим ногами 45°')).toBeTruthy()
})

test('пустой результат: сообщение и кнопка «Показать все»', () => {
  render(<MachineTree machines={MACHINES} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), { target: { value: 'гантель' } })

  expect(screen.getByText('По запросу «гантель» тренажёров не нашлось')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Показать все' }))

  expect(screen.getByText('Всего тренажёров: 4')).toBeTruthy()
})

test('без тренажёров — подпись, а не пустое место', () => {
  render(<MachineTree machines={[]} />)

  expect(screen.getByText('Пока ни одного тренажёра')).toBeTruthy()
})
