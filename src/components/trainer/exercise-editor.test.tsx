// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { ExerciseDetail } from '@/modules/catalog'
import { ExerciseEditor, publishChecklist } from './exercise-editor'

// Серверные действия и фигуру мышц в jsdom не рендерим — подменяем заглушками.
const server = vi.hoisted(() => ({
  archiveError: null as string | null,
  archived: false,
  saveId: null as string | null,
  saveError: null as string | null,
  reviewIssues: [] as { field: string; text: string; severity: 'error' | 'warning' }[],
  review: null as null | { summary: string; fix: Record<string, unknown> },
  reviewError: null as string | null,
}))

vi.mock('@/app/(app)/app/trainer/exercises/actions', () => ({
  saveExerciseAction: async () => ({ error: server.saveError, id: server.saveId }),
  unpublishAction: async () => {},
  draftExerciseAction: async () => ({ draft: null, error: null }),
  archiveExerciseAction: async () => ({ error: server.archiveError, archived: server.archived }),
  reviewExerciseAction: async () => ({
    error: server.reviewError,
    issues: server.reviewIssues,
    review: server.review,
  }),
}))

// Уведомления проверяем по вызовам, а не по отрисованному тостеру.
const toasts = vi.hoisted(() => ({ success: [] as string[], error: [] as string[] }))

vi.mock('sonner', () => ({
  toast: {
    success: (title: string) => toasts.success.push(title),
    error: (title: string) => toasts.error.push(title),
  },
}))

vi.mock('@/components/muscle-figure/muscle-figure', () => ({
  MuscleFigure: () => <div data-testid="figure" />,
}))

// Диалоги Radix в jsdom портируют содержимое в body — подменяем простым условием по `open`.
const dialog = vi.hoisted(() => ({ open: false }))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div role="dialog">{children}</div> : null,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
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
  loadType: 'external',
  defaultRepMax: 12,
  overlayProfile: 'none',
  videoMp4Url: null,
  videoWebmUrl: null,
  musclesMp4Url: null,
  weightStepKg: 5,
}

afterEach(() => {
  cleanup()
  toasts.success = []
  toasts.error = []
  server.archived = false
  server.archiveError = null
  server.saveId = null
  server.saveError = null
  dialog.open = false
})

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

test('удаление живёт только на вкладке «Публикация»', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  // На «Описании» блока удаления нет — раньше он висел под каждым табом.
  expect(screen.queryByText('Удалить упражнение')).toBeNull()

  fireEvent.click(tab('Видео'))
  expect(screen.queryByText('Удалить упражнение')).toBeNull()

  fireEvent.click(tab('Мышцы'))
  expect(screen.queryByText('Удалить упражнение')).toBeNull()

  fireEvent.click(tab('Публикация'))
  expect(screen.getByText('Удалить упражнение')).toBeTruthy()
})

test('блок удаления упражнения: подтверждение и понятный текст про историю', async () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(tab('Публикация'))
  expect(screen.getByText('Удалить упражнение')).toBeTruthy()
  expect(screen.getByText(/история подходов клиентов останется/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  expect(await screen.findByText('Удалить «Гакк-приседания»?')).toBeTruthy()
  expect(screen.getByText(/подходы и веса останутся в истории клиентов/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Отмена' })).toBeTruthy()
})

test('удаление: успех — уведомление и закрытие окна', async () => {
  server.archived = true
  const onDeleted = vi.fn()

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} onDeleted={onDeleted} />)

  fireEvent.click(tab('Публикация'))
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  await screen.findByText('Удалить «Гакк-приседания»?')
  fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]!)

  await vi.waitFor(() => expect(toasts.success).toContain('Упражнение удалено'))
  expect(onDeleted).toHaveBeenCalled()
})

test('удаление: ошибка сервера показывается уведомлением', async () => {
  server.archiveError = 'Недостаточно прав'

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(tab('Публикация'))
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  await screen.findByText('Удалить «Гакк-приседания»?')
  fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]!)

  await vi.waitFor(() => expect(toasts.error).toContain('Недостаточно прав'))
})

test('сохранение: вместо строчки «Сохранено» — всплывающий алерт', async () => {
  server.saveId = 'ex-1'

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(toasts.success).toContain('Сохранено'))
  // Строчки под формой больше нет — только уведомление.
  expect(screen.queryByText('Сохранено')).toBeNull()
})

test('публикация: алерт «Опубликовано»', async () => {
  server.saveId = 'ex-1'

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }))

  await vi.waitFor(() => expect(toasts.success).toContain('Опубликовано'))
})

test('ошибка сохранения приходит уведомлением', async () => {
  server.saveError = 'Название слишком короткое'

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(toasts.error).toContain('Название слишком короткое'))
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

test('вкладка «МаксИИм»: проверка карточки и применение исправлений', async () => {
  server.reviewIssues = [
    { field: 'mistakes', text: 'Нет частых ошибок — это первое, что смотрит клиент', severity: 'warning' },
  ]
  server.review = {
    summary: 'Добавил ошибки и совет',
    fix: {
      name: 'Гакк-приседания в машине',
      repMin: 8,
      repMax: 10,
      steps: ['Встань в тренажёр', 'Опустись до прямого угла', 'Выжми'],
      mistakes: ['Отрыв пяток'],
      tip: 'Колени по носкам',
      primary: ['quads'],
      secondary: ['glutes'],
    },
  }

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(tab('МаксИИм'))
  expect(screen.getByText(/В карточку ничего не попадёт/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Проверить карточку/ }))

  expect(await screen.findByText('Добавил ошибки и совет')).toBeTruthy()
  expect(screen.getByText('Нет частых ошибок — это первое, что смотрит клиент')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Применить исправления' }))

  // После применения форма открывается на «Описании» с новыми значениями.
  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe(
    'Гакк-приседания в машине',
  )
  expect(toasts.success).toContain('Поля заполнены')

  fireEvent.click(tab('Публикация'))
  expect(screen.getByText(/Основные мышцы: Квадрицепсы/)).toBeTruthy()
})

test('вкладка «МаксИИм»: без модели показывает замечания и честный текст', async () => {
  server.review = null
  server.reviewError = 'МаксИИм сейчас недоступен — ниже замечания, которые проверяются без него'
  server.reviewIssues = [
    { field: 'steps', text: 'Нет шагов «Как делать»', severity: 'error' },
  ]

  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(tab('МаксИИм'))
  fireEvent.click(screen.getByRole('button', { name: /Проверить карточку/ }))

  expect(await screen.findByText(/МаксИИм сейчас недоступен/)).toBeTruthy()
  expect(screen.getByText('Без этого не опубликовать')).toBeTruthy()
  expect(screen.getByText('Нет шагов «Как делать»')).toBeTruthy()
  // Кнопки «Применить» нет — применять нечего.
  expect(screen.queryByRole('button', { name: 'Применить исправления' })).toBeNull()
})

