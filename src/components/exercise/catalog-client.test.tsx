// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ExerciseListItem } from '@/modules/catalog'
import { CatalogClient, exercisesLabel } from './catalog-client'

// `next/link` вне Next-роутера не рендерится — для теста достаточно обычной ссылки.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

const FIGURES = {
  front: read('public/figure/front.svg'),
  back: read('public/figure/back.svg'),
}

/** Фигура в каталоге грузится так же, как в браузере. */
function stubFigureFetch(): void {
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const text = String(input).endsWith('back.svg') ? FIGURES.back : FIGURES.front

    return { ok: true, status: 200, text: async () => text }
  })

  vi.stubGlobal('fetch', fetchStub as unknown as typeof fetch)
}

const MACHINES = [
  { id: 'machine-1', name: 'Верхний блок' },
  { id: 'machine-2', name: 'Гакк-машина' },
  { id: 'machine-3', name: 'Жим лёжа' },
]

function exercise(
  name: string,
  primaryMuscles: string[],
  secondaryMuscles: string[] = [],
  machine: { id: string; name: string } | null = null,
): ExerciseListItem {
  return {
    id: name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    machineId: machine?.id ?? null,
    machineName: machine?.name ?? null,
    machineZone: null,
    primaryMuscles,
    secondaryMuscles,
    status: 'published',
    posterUrl: null,
    photoUrl: null,
    thumbUrl: null,
    hasVideo: false,
    videoStatus: null,
    hasMuscles: false,
  }
}

const ITEMS: ExerciseListItem[] = [
  exercise('Тяга верхнего блока к груди', ['lats'], ['biceps', 'traps-middle'], MACHINES[0]),
  exercise('Жим лёжа в тренажёре', ['chest'], ['triceps', 'delts-front'], MACHINES[2]),
  exercise('Гакк-приседания', ['quads'], ['glutes'], MACHINES[1]),
  exercise('Сгибания на бицепс', ['biceps'], [], MACHINES[0]),
]

/** Названия упражнений в списке — в том порядке, в каком их видит человек. */
function listedExercises(): string[] {
  return screen
    .queryAllByRole('link')
    .map((link) => (link.querySelector('span')?.textContent ?? '').trim())
}

/** Весь текст экрана одним куском: подпись фильтра собрана из нескольких узлов. */
function pageText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

beforeEach(() => {
  stubFigureFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('exercisesLabel: склонение по DESIGN §9.2', () => {
  expect(exercisesLabel(0)).toBe('0 упражнений')
  expect(exercisesLabel(1)).toBe('1 упражнение')
  expect(exercisesLabel(2)).toBe('2 упражнения')
  expect(exercisesLabel(4)).toBe('4 упражнения')
  expect(exercisesLabel(5)).toBe('5 упражнений')
  expect(exercisesLabel(11)).toBe('11 упражнений')
  expect(exercisesLabel(21)).toBe('21 упражнение')
  expect(exercisesLabel(22)).toBe('22 упражнения')
})

test('рядом с фигурой — мышцы видимой стороны с числом упражнений', async () => {
  render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  const group = screen.getByRole('group', { name: 'Мышцы' })

  // Спереди: свои мышцы, названия по-русски, счётчики упражнений.
  expect(within(group).getByRole('button', { name: /Грудные/ }).textContent).toContain('1')
  expect(within(group).getByRole('button', { name: /Бицепс/ }).textContent).toContain('2')
  expect(within(group).getByRole('button', { name: /Квадрицепсы/ }).textContent).toContain('1')
  expect(within(group).queryByRole('button', { name: /Широчайшие/ })).toBeNull()

  // Мышц без упражнений в каталоге нет — чип неактивен и не уводит в пустой экран.
  const neck = within(group).getByRole('button', { name: /Шея/ })
  expect(neck.hasAttribute('disabled')).toBe(true)
  expect(neck.textContent).toContain('0')

  // Сзади — другой набор мышц.
  fireEvent.click(screen.getByRole('button', { name: 'Сзади' }))
  await waitFor(() =>
    expect(within(group).getByRole('button', { name: /Широчайшие/ }).textContent).toContain('1'),
  )
  expect(within(group).queryByRole('button', { name: /Грудные/ })).toBeNull()
})

test('выбор мышцы чипом: фильтр, подпись по-русски, повторное касание снимает', async () => {
  render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  expect(listedExercises()).toHaveLength(4)
  expect(screen.getByText('Коснись мышцы на фигуре или выбери из списка')).toBeTruthy()

  const chest = screen.getByRole('button', { name: /Грудные/ })
  fireEvent.click(chest)

  expect(listedExercises()).toEqual(['Жим лёжа в тренажёре'])
  expect(chest.getAttribute('aria-pressed')).toBe('true')
  expect(pageText()).toContain('Фильтр: Грудные · 1 упражнение')

  // Повторное касание того же чипа снимает фильтр.
  fireEvent.click(chest)
  expect(listedExercises()).toHaveLength(4)
  expect(pageText()).not.toContain('Фильтр:')
})

test('мышцу можно выбрать и на фигуре, и сбросить кнопкой', async () => {
  const { container } = render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  const quads = await waitFor(() => {
    const path = container.querySelector<SVGPathElement>('[data-muscle="quads"]')
    if (!path) throw new Error('фигура ещё не загрузилась')
    return path
  })

  fireEvent.click(quads)
  expect(listedExercises()).toEqual(['Гакк-приседания'])
  expect(pageText()).toContain('Фильтр: Квадрицепсы · 1 упражнение')

  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }))
  expect(listedExercises()).toHaveLength(4)
})

test('поиск сужает список и счётчики мышц', () => {
  render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  fireEvent.change(screen.getByPlaceholderText('Найти упражнение'), { target: { value: 'тяга' } })

  expect(listedExercises()).toEqual(['Тяга верхнего блока к груди'])

  const group = screen.getByRole('group', { name: 'Мышцы' })
  // Грудные в поиск не попали — чип неактивен.
  expect(within(group).getByRole('button', { name: /Грудные/ }).hasAttribute('disabled')).toBe(true)
})

test('упражнения, где мышца основная, идут выше', () => {
  render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: /Бицепс/ }))

  expect(listedExercises()).toEqual(['Сгибания на бицепс', 'Тяга верхнего блока к груди'])
})

test('фильтр по тренажёру оставляет только его упражнения', () => {
  render(<CatalogClient items={ITEMS} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: 'Верхний блок' }))
  expect(listedExercises()).toEqual(['Тяга верхнего блока к груди', 'Сгибания на бицепс'])

  // Счётчики мышц пересчитываются по найденному: квадрицепсы остались в других тренажёрах.
  const group = screen.getByRole('group', { name: 'Мышцы' })
  expect(within(group).getByRole('button', { name: /Квадрицепсы/ }).hasAttribute('disabled')).toBe(
    true,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Все тренажёры' }))
  expect(listedExercises()).toHaveLength(4)
})
