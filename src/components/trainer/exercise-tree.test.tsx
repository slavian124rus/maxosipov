// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ExerciseTree } from './exercise-tree'
import type { ExerciseTreeItem } from './catalog-tree'

// Окно правки живёт на серверном действии и роутере — в jsdom подменяем оба.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/app/(app)/app/trainer/exercises/actions', () => ({
  loadExerciseAction: async () => ({ exercise: null, machines: [], error: 'Нет данных' }),
  saveExerciseAction: async () => ({ error: null, id: null }),
  unpublishAction: async () => {},
  draftExerciseAction: async () => ({ draft: null, error: null }),
}))

type Machine = { id: string; name: string; zone: string | null }

const GAKK: Machine = { id: 'm-gakk', name: 'Гакк-машина', zone: 'Ноги' }
const BLOCK: Machine = { id: 'm-block', name: 'Верхний блок', zone: 'Спина' }

function item(
  name: string,
  status: 'draft' | 'published',
  machine: Machine | null,
  muscles: string[] = [],
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

const ITEMS: ExerciseTreeItem[] = [
  item('Гакк-приседания', 'published', GAKK, ['Квадрицепсы']),
  item('Тяга верхнего блока', 'published', BLOCK, ['Широчайшие']),
  item('Швунг со штангой', 'published', null, ['Плечи']),
  item('Жим ногами', 'draft', GAKK, ['Квадрицепсы']),
]

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

/** Строка упражнения — кнопка: в jsdom `<mark>` не входит в доступное имя, ищем по тексту. */
function exerciseRow(name: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.includes(name) && button.getAttribute('aria-expanded') === null,
    ) ?? null
  )
}

test('вкладки со счётчиками, зоны раскрыты, тренажёры свёрнуты', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  expect(screen.getByRole('button', { name: /Опубликованы/ }).textContent).toContain('3')
  expect(screen.getByRole('button', { name: /Черновики/ }).textContent).toContain('1')

  // Зоны видны сразу, упражнения — только после раскрытия тренажёра.
  expect(screen.getByRole('button', { name: /^Ноги/ }).getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('button', { name: /Гакк-машина/ }).getAttribute('aria-expanded')).toBe(
    'false',
  )
  expect(screen.queryByText('Гакк-приседания')).toBeNull()
})

test('клик по тренажёру раскрывает его упражнения', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  const machine = screen.getByRole('button', { name: /Гакк-машина/ })
  fireEvent.click(machine)

  expect(machine.getAttribute('aria-expanded')).toBe('true')
  expect(exerciseRow('Гакк-приседания')).toBeTruthy()
})

test('упражнения без тренажёра висят прямо на зоне «Без тренажёра»', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  // Зона раскрыта, уровня тренажёра нет — упражнение видно сразу.
  expect(exerciseRow('Швунг со штангой')).toBeTruthy()
})

test('касание упражнения открывает окно правки, а не уводит со страницы', async () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  const row = exerciseRow('Швунг со штангой')
  if (!row) throw new Error('нет строки упражнения')
  fireEvent.click(row)

  // Диалог открылся и запросил данные (в тесте действие отвечает ошибкой).
  expect(await screen.findByText('Нет данных')).toBeTruthy()
  expect(window.location.pathname).toBe('/')
})

test('переключение на черновики меняет дерево и адрес', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  fireEvent.click(screen.getByRole('button', { name: /Черновики/ }))

  expect(screen.getByRole('button', { name: /Черновики/ }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(screen.queryByText('Швунг со штангой')).toBeNull()
  expect(screen.getByRole('button', { name: /^Ноги/ }).textContent).toContain('1')
  expect(window.location.search).toBe('?tab=draft')
})

test('стартовая вкладка берётся из адреса', () => {
  render(<ExerciseTree items={ITEMS} initialTab="draft" />)

  expect(screen.getByRole('button', { name: /Черновики/ }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(screen.getByRole('button', { name: /^Ноги/ }).textContent).toContain('1')
})

test('поиск раскрывает ветку, подсвечивает совпадение и считает найденное', () => {
  const { container } = render(<ExerciseTree items={ITEMS} initialTab="published" />)

  fireEvent.change(screen.getByLabelText('Поиск по упражнениям'), { target: { value: 'тяга' } })

  expect(screen.getByText('Найдено: 1')).toBeTruthy()
  // Ветка раскрылась сама — упражнение видно без клика по тренажёру.
  expect(exerciseRow('Тяга верхнего блока')).toBeTruthy()
  expect(container.querySelector('mark')?.textContent).toBe('Тяга')
  // Лишние зоны из дерева ушли.
  expect(screen.queryByRole('button', { name: /^Ноги/ })).toBeNull()
})

test('поиск работает по тренажёру, зоне и мышце, «ё» не мешает', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)
  const search = screen.getByLabelText('Поиск по упражнениям')

  fireEvent.change(search, { target: { value: 'гакк' } })
  expect(screen.getByText('Найдено: 1')).toBeTruthy()

  fireEvent.change(search, { target: { value: 'ШИРОЧАЙШИЕ' } })
  expect(screen.getByText('Найдено: 1')).toBeTruthy()
  expect(exerciseRow('Тяга верхнего блока')).toBeTruthy()

  fireEvent.change(search, { target: { value: 'ноги' } })
  expect(screen.getByText('Найдено: 1')).toBeTruthy()
})

test('пустой результат поиска: сообщение и кнопка очистки', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  fireEvent.change(screen.getByLabelText('Поиск по упражнениям'), {
    target: { value: 'гантель' },
  })

  expect(screen.getByText('По запросу «гантель» ничего не нашлось')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Показать все' }))

  expect(screen.queryByText(/ничего не нашлось/)).toBeNull()
  expect(screen.getByRole('button', { name: /^Ноги/ })).toBeTruthy()
})

test('кнопка очистки в поле поиска убирает запрос', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  fireEvent.change(screen.getByLabelText('Поиск по упражнениям'), { target: { value: 'жим' } })
  expect(screen.getByText('Найдено: 0')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }))
  expect(screen.getByText('Опубликованы: 3')).toBeTruthy()
})

test('«Развернуть» и «Свернуть» управляют всем деревом', () => {
  render(<ExerciseTree items={ITEMS} initialTab="published" />)

  fireEvent.click(screen.getByRole('button', { name: 'Развернуть' }))
  expect(exerciseRow('Гакк-приседания')).toBeTruthy()
  expect(exerciseRow('Тяга верхнего блока')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }))
  expect(exerciseRow('Гакк-приседания')).toBeNull()
  // Зоны свёрнуты — тренажёров не видно.
  expect(screen.queryByRole('button', { name: /Гакк-машина/ })).toBeNull()
  expect(screen.getByRole('button', { name: /^Ноги/ }).getAttribute('aria-expanded')).toBe('false')
})

test('в пустой вкладке — понятная подпись', () => {
  render(<ExerciseTree items={[item('Одно', 'published', GAKK)]} initialTab="draft" />)

  expect(screen.getByText('Черновиков нет')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Развернуть' }).hasAttribute('disabled')).toBe(true)
})
