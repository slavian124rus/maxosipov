// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MachineTree, machineMeta } from './machine-tree'
import type { MachineTreeItem } from './catalog-tree'

const MACHINES: MachineTreeItem[] = [
  {
    id: 'm1',
    name: 'Гакк-машина',
    zone: 'Ноги',
    weightStepKg: 5,
    exerciseCount: 2,
    thumbUrl: '/media/photo.webp?sig=1',
    photoStatus: 'ready',
  },
  { id: 'm2', name: 'Жим ногами 45°', zone: 'Ноги', weightStepKg: 5, exerciseCount: 0 },
  { id: 'm3', name: 'Верхний блок', zone: 'Спина', weightStepKg: 2.5, exerciseCount: 3 },
  { id: 'm4', name: 'Скамья без зоны', zone: null, weightStepKg: 5, exerciseCount: 1 },
]

const noop = () => {}

afterEach(cleanup)

test('дерево: зоны по алфавиту, «Без зоны» в конце, внутри — тренажёры', () => {
  render(<MachineTree machines={MACHINES} onEdit={noop} />)

  expect(screen.getByText('Всего тренажёров: 4')).toBeTruthy()

  const zones = screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-expanded'))
  expect(zones.map((zone) => zone.textContent)).toEqual(['Ноги2', 'Спина1', 'Без зоны1'])

  // Зоны раскрыты: тренажёры видны сразу, с шагом веса и числом упражнений.
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
  expect(screen.getByText('шаг 5 кг · 2 в каталоге')).toBeTruthy()
  expect(screen.getByText('шаг 2,5 кг · 3 в каталоге · без фото')).toBeTruthy()
  expect(screen.getByText('шаг 5 кг · в каталоге пока нет · без фото')).toBeTruthy()
})

test('у тренажёра с фото — миниатюра, у остальных иконка', () => {
  const { container } = render(<MachineTree machines={MACHINES} onEdit={noop} />)

  const thumb = container.querySelector('img[src="/media/photo.webp?sig=1"]')
  expect(thumb?.getAttribute('class')).toContain('object-cover')
  expect(container.querySelectorAll('img')).toHaveLength(1)
})

test('касание тренажёра открывает его правку', () => {
  const onEdit = vi.fn()
  render(<MachineTree machines={MACHINES} onEdit={onEdit} />)

  fireEvent.click(screen.getByRole('button', { name: /Верхний блок/ }))

  expect(onEdit).toHaveBeenCalledWith('m3')
})

test('machineMeta: «без веса» для кардио вместо «шаг 0 кг»', () => {
  expect(machineMeta({ ...MACHINES[1]!, weightStepKg: 0, thumbUrl: '/t.webp' })).toBe(
    'без веса · в каталоге пока нет',
  )
})

test('machineMeta: шаг, упражнения и состояние фото', () => {
  expect(machineMeta(MACHINES[0]!)).toBe('шаг 5 кг · 2 в каталоге')
  expect(machineMeta({ ...MACHINES[1]!, photoStatus: 'processing' })).toBe(
    'шаг 5 кг · в каталоге пока нет · фото обрабатывается',
  )
  expect(machineMeta({ ...MACHINES[1]!, photoStatus: 'failed' })).toBe(
    'шаг 5 кг · в каталоге пока нет · фото не загрузилось',
  )
  expect(machineMeta({ ...MACHINES[1]!, thumbUrl: '/t.webp', photoStatus: 'ready' })).toBe(
    'шаг 5 кг · в каталоге пока нет',
  )
})

test('зона сворачивается и раскрывается', () => {
  render(<MachineTree machines={MACHINES} onEdit={noop} />)

  const legs = screen.getByRole('button', { name: /^Ноги/ })
  fireEvent.click(legs)

  expect(legs.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('Гакк-машина')).toBeNull()

  fireEvent.click(legs)
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
})

test('поиск оставляет только подходящие тренажёры и зоны', () => {
  const { container } = render(<MachineTree machines={MACHINES} onEdit={noop} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), { target: { value: 'блок' } })

  expect(screen.getByText('Найдено тренажёров: 1')).toBeTruthy()
  expect(container.querySelector('mark')?.textContent).toBe('блок')
  // Подсветка режет имя на части, поэтому смотрим весь текст дерева.
  expect(container.textContent).toContain('Верхний блок')
  expect(screen.queryByText('Гакк-машина')).toBeNull()
})

test('поиск по названию зоны показывает все её тренажёры', () => {
  render(<MachineTree machines={MACHINES} onEdit={noop} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), { target: { value: 'НОГИ' } })

  expect(screen.getByText('Найдено тренажёров: 2')).toBeTruthy()
  expect(screen.getByText('Гакк-машина')).toBeTruthy()
  expect(screen.getByText('Жим ногами 45°')).toBeTruthy()
})

test('пустой результат: сообщение и кнопка «Показать все»', () => {
  render(<MachineTree machines={MACHINES} onEdit={noop} />)

  fireEvent.change(screen.getByLabelText('Поиск по тренажёрам'), {
    target: { value: 'гантель' },
  })

  expect(screen.getByText('По запросу «гантель» тренажёров не нашлось')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Показать все' }))

  expect(screen.getByText('Всего тренажёров: 4')).toBeTruthy()
})

test('без тренажёров — подпись, а не пустое место', () => {
  render(<MachineTree machines={[]} onEdit={noop} />)

  expect(screen.getByText('Пока ни одного тренажёра')).toBeTruthy()
})
