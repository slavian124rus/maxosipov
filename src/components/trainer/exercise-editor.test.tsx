// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { ExerciseDetail } from '@/modules/catalog'
import { ExerciseEditor, publishChecklist } from './exercise-editor'

// Серверные действия и фигуру мышц в jsdom не рендерим — подменяем заглушками.
vi.mock('@/app/(app)/app/trainer/exercises/actions', () => ({
  saveExerciseAction: async () => ({ error: null, id: null }),
  unpublishAction: async () => {},
  draftExerciseAction: async () => ({ draft: null, error: null }),
}))

vi.mock('@/components/muscle-figure/muscle-figure', () => ({
  MuscleFigure: () => <div data-testid="figure" />,
}))

const MACHINES = [
  { id: 'm-gakk', name: 'Гакк-машина', zone: 'Ноги' },
  { id: 'm-block', name: 'Верхний блок', zone: 'Спина' },
]

const EXERCISE: ExerciseDetail = {
  id: 'ex-1',
  slug: 'gakk-prisedaniya',
  name: 'Гакк-приседания',
  machineId: 'm-gakk',
  machineName: 'Гакк-машина',
  machineZone: 'Ноги',
  primaryMuscles: ['quads'],
  secondaryMuscles: ['glutes'],
  status: 'draft',
  posterUrl: null,
  photoUrl: null,
  thumbUrl: null,
  hasVideo: false,
  videoStatus: null,
  hasMuscles: false,
  steps: ['Встань в тренажёр'],
  mistakes: ['Отрыв пяток'],
  tips: 'Колени по носкам',
  defaultRepMin: 10,
  defaultRepMax: 12,
  overlayProfile: 'none',
  videoMp4Url: null,
  videoWebmUrl: null,
  musclesMp4Url: null,
  weightStepKg: 5,
}

afterEach(cleanup)

/** Вкладка окна правки. */
function tab(label: string): HTMLElement {
  return screen.getByRole('tab', { name: label })
}

test('окно открывается на «Описании» с заполненными полями упражнения', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  expect(tab('Описание').getAttribute('aria-selected')).toBe('true')
  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Гакк-приседания')
  expect((screen.getByLabelText('Повторений от') as HTMLInputElement).value).toBe('10')
  expect((screen.getByLabelText('Совет') as HTMLTextAreaElement).value).toBe('Колени по носкам')
})

test('вкладки переключаются и не теряют введённое', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Гакк (новое)' } })

  fireEvent.click(tab('Тренажёр'))
  expect(tab('Тренажёр').getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('button', { name: /Гакк-машина/ }).getAttribute('aria-pressed')).toBe(
    'true',
  )

  fireEvent.click(tab('Мышцы'))
  expect(screen.getByTestId('figure')).toBeTruthy()

  fireEvent.click(tab('Видео'))
  expect(screen.getByLabelText('Выбрать видео')).toBeTruthy()

  // Вернулись в описание — правка на месте.
  fireEvent.click(tab('Описание'))
  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Гакк (новое)')
})

test('вкладка «Публикация»: статус, чек-лист и кнопки', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(tab('Публикация'))

  expect(screen.getByText(/черновик, клиенты не видят/)).toBeTruthy()
  expect(screen.getByText('Отмечена хотя бы одна основная мышца')).toBeTruthy()
  expect(screen.getByText('Есть хотя бы один шаг «Как делать»')).toBeTruthy()
  // Видео нет — третий пункт не выполнен.
  expect(screen.getByText('Есть видео или фото тренажёра')).toBeTruthy()

  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeTruthy()
  // У черновика кнопки «Вернуть в черновики» нет.
  expect(screen.queryByRole('button', { name: 'Вернуть в черновики' })).toBeNull()
})

test('у опубликованного упражнения есть «Вернуть в черновики»', () => {
  render(
    <ExerciseEditor exercise={{ ...EXERCISE, status: 'published' }} machines={MACHINES} />,
  )

  fireEvent.click(tab('Публикация'))
  expect(screen.getByText(/опубликовано, клиенты видят/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Вернуть в черновики' })).toBeTruthy()
})

test('publishChecklist: три условия публикации', () => {
  expect(publishChecklist({ primaryMuscles: 0, steps: 0, hasVideo: false })).toEqual([
    { label: 'Отмечена хотя бы одна основная мышца', done: false },
    { label: 'Есть хотя бы один шаг «Как делать»', done: false },
    { label: 'Есть видео или фото тренажёра', done: false },
  ])

  expect(
    publishChecklist({ primaryMuscles: 1, steps: 2, hasVideo: true }).every((item) => item.done),
  ).toBe(true)
})
