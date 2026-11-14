// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  suggestAlternativesAction: async () => [],
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
  videoMediaId: null,
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


test('вкладка «Замены» есть, когда переданы альтернативы, и показывает заданные тренером', () => {
  render(
    <ExerciseEditor
      exercise={EXERCISE}
      machines={MACHINES}
      alternatives={{
        initial: [{ id: 'ex-2', name: 'Жим ногами', machineName: 'Платформа' }],
        catalog: [{ id: 'ex-2', name: 'Жим ногами', machineName: 'Платформа' }],
      }}
    />,
  )

  fireEvent.click(tab('Замены'))
  expect(screen.getByText('Можно заменить на')).toBeTruthy()
  expect(screen.getByText('Жим ногами')).toBeTruthy()
})

test('без данных об альтернативах вкладки «Замены» нет', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)
  expect(screen.queryByRole('tab', { name: 'Замены' })).toBeNull()
})

test('вкладка «Видео»: загруженное видео можно посмотреть прямо в окне', () => {
  const { container } = render(
    <ExerciseEditor
      exercise={{
        ...EXERCISE,
        hasVideo: true,
        videoStatus: 'ready',
        videoMp4Url: '/media/video.mp4?sig=1',
        videoWebmUrl: '/media/video.webm?sig=1',
        posterUrl: '/media/poster.jpg?sig=1',
      }}
      machines={MACHINES}
    />,
  )

  fireEvent.click(tab('Видео'))

  const video = container.querySelector('video[controls]')
  expect(video).toBeTruthy()
  expect(video?.getAttribute('poster')).toBe('/media/poster.jpg?sig=1')
  expect(container.querySelector('source[type="video/mp4"]')?.getAttribute('src')).toBe('/media/video.mp4?sig=1')
})

test('вкладка «Видео»: пока ролик обрабатывается, так и написано, плеера нет', () => {
  const { container } = render(
    <ExerciseEditor exercise={{ ...EXERCISE, videoStatus: 'processing' }} machines={MACHINES} />,
  )

  fireEvent.click(tab('Видео'))

  expect(screen.getByText(/Видео обрабатывается/)).toBeTruthy()
  expect(container.querySelector('video')).toBeNull()
})

test('у упражнения с видео форма просит сервер оставить его, а не стереть', () => {
  const { container } = render(
    <ExerciseEditor
      exercise={{ ...EXERCISE, hasVideo: true, videoStatus: 'ready', videoMp4Url: '/media/v.mp4' }}
      machines={MACHINES}
    />,
  )

  expect(container.querySelector('input[name="keepVideo"]')?.getAttribute('value')).toBe('1')
  expect(container.querySelector('input[name="videoMediaId"]')?.getAttribute('value')).toBe('')
})

test('у упражнения без видео признака «оставить видео» нет', () => {
  const { container } = render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)
  expect(container.querySelector('input[name="keepVideo"]')?.getAttribute('value') ?? '').toBe('')
})

const ALTS = {
  initial: [{ id: 'ex-2', name: 'Жим ногами', machineName: 'Платформа' }],
  catalog: [
    { id: 'ex-2', name: 'Жим ногами', machineName: 'Платформа', machineId: 'm-p', machineZone: 'Ноги' },
    { id: 'ex-3', name: 'Выпады', machineName: null, machineId: null, machineZone: null },
  ],
}

test('вкладка «Замены» не имеет своей кнопки «Сохранить»: список уходит с общим сохранением', () => {
  const { container } = render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} alternatives={ALTS} />)

  fireEvent.click(tab('Замены'))

  // «Сохранить» остаётся одна — внизу окна.
  expect(screen.getAllByRole('button', { name: 'Сохранить' })).toHaveLength(1)
  expect(JSON.parse(container.querySelector('input[name="alternatives"]')!.getAttribute('value')!)).toEqual(['ex-2'])
})

test('добавление замены из дерева каталога попадает в поле формы', () => {
  const { container } = render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} alternatives={ALTS} />)

  fireEvent.click(tab('Замены'))
  fireEvent.click(screen.getByRole('button', { name: 'Добавить из каталога' }))
  // Зоны раскрыты сразу, тренажёры раскрываются по касанию (как в каталоге тренера).
  expect(screen.getByRole('button', { name: /Платформа/ }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: /Выпады/ }))

  expect(JSON.parse(container.querySelector('input[name="alternatives"]')!.getAttribute('value')!)).toEqual([
    'ex-2',
    'ex-3',
  ])
})

test('без вкладки «Замены» поле alternatives в форму не попадает', () => {
  const { container } = render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)
  expect(container.querySelector('input[name="alternatives"]')).toBeNull()
})

test('в дереве выбора уже добавленная замена отмечена и недоступна для повторного выбора', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} alternatives={ALTS} />)

  fireEvent.click(tab('Замены'))
  fireEvent.click(screen.getByRole('button', { name: 'Добавить из каталога' }))
  fireEvent.click(screen.getByRole('button', { name: /Платформа/ }))

  const chosen = screen.getAllByRole('button', { name: /Жим ногами/ }).find((button) => (button as HTMLButtonElement).disabled)
  expect(chosen).toBeTruthy()
})

test('нижняя панель кнопок залипает снизу на тёмной непрозрачной подложке, а не просвечивает', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  const footer = screen.getByRole('button', { name: 'Сохранить' }).parentElement!
  expect(footer.className).toContain('sticky')
  expect(footer.className).toContain('bg-bg')
  expect(footer.className).not.toContain('bg-transparent')
})

test('«Какой вес у упражнения» живёт на вкладке «Описание», а не «Тренажёр»', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  expect(screen.getByText('Какой вес у упражнения')).toBeTruthy()

  fireEvent.click(tab('Тренажёр'))
  expect(screen.queryByText('Какой вес у упражнения')).toBeNull()
})

test('выбранный тип веса уходит в форму', () => {
  const { container } = render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)

  fireEvent.click(screen.getByRole('button', { name: /Свой вес \+ отягощение/ }))
  expect(container.querySelector('input[name="loadType"]')?.getAttribute('value')).toBe('bodyweight_plus')
})

test('«Убрать видео» отвязывает видео при сохранении, «Вернуть» отменяет', () => {
  const { container } = render(
    <ExerciseEditor
      exercise={{ ...EXERCISE, hasVideo: true, videoStatus: 'ready', videoMp4Url: '/media/v.mp4' }}
      machines={MACHINES}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: 'Видео' }))
  fireEvent.click(screen.getByRole('button', { name: 'Убрать видео' }))

  expect(container.querySelector('input[name="keepVideo"]')?.getAttribute('value') ?? '').toBe('')
  expect(container.querySelector('input[name="videoMediaId"]')?.getAttribute('value')).toBe('')
  expect(screen.getByText(/Видео уберётся из карточки/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Вернуть видео' }))
  expect(container.querySelector('input[name="keepVideo"]')?.getAttribute('value')).toBe('1')
})

test('у упражнения без видео кнопки «Убрать видео» нет', () => {
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Видео' }))
  expect(screen.queryByRole('button', { name: 'Убрать видео' })).toBeNull()
})

test('видео в обработке само становится плеером, пока окно открыто', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ready', playback: { mp4: '/ready.mp4', webm: null, poster: null } }),
    }),
  )
  const { container } = render(
    <ExerciseEditor
      exercise={{ ...EXERCISE, videoMediaId: 'vid-1', videoStatus: 'processing' }}
      machines={MACHINES}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: 'Видео' }))
  expect(screen.getByRole('status').textContent).toContain('Видео обрабатывается')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3100)
  })

  expect(screen.queryByRole('status')).toBeNull()
  expect(container.querySelector('video source')?.getAttribute('src')).toBe('/ready.mp4')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('«Закрыть» закрывает окно, а не просто обновляет дерево', () => {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} onSaved={onSaved} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onSaved).not.toHaveBeenCalled()
})

test('после успешного сохранения дерево обновляется (onSaved), окно остаётся открытым', async () => {
  server.saveId = 'ex-1'
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(<ExerciseEditor exercise={EXERCISE} machines={MACHINES} onSaved={onSaved} onClose={onClose} />)

  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(onClose).not.toHaveBeenCalled()
})
