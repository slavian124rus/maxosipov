// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MuscleFigure, normalizeFigureSvg } from './muscle-figure'

/** Vitest запускается из корня репозитория — файлы фигуры читаем из `public/`. */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

const FIGURES = {
  front: read('public/figure/front.svg'),
  back: read('public/figure/back.svg'),
}

/** Файлы фигуры лежат в `public/` — отдаём их так же, как браузеру. */
function stubFigureFetch(): void {
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const text = String(input).endsWith('back.svg') ? FIGURES.back : FIGURES.front

    return { ok: true, status: 200, text: async () => text }
  })

  vi.stubGlobal('fetch', fetchStub as unknown as typeof fetch)
}

/** Видимая мышца (`hit = true` — её прозрачная копия для зоны касания). */
function musclePath(container: HTMLElement, code: string, hit = false): SVGPathElement {
  const selector = hit
    ? `[data-muscle="${code}"][data-muscle-hit]`
    : `[data-muscle="${code}"]:not([data-muscle-hit])`
  const path = container.querySelector<SVGPathElement>(selector)
  if (!path) throw new Error(`в фигуре нет мышцы ${code}`)
  return path
}

function canvasOf(container: HTMLElement): HTMLElement {
  const canvas = container.querySelector<HTMLElement>('[role="img"]')
  if (!canvas) throw new Error('нет контейнера фигуры')
  return canvas
}

function pressed(name: string): string | null {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed')
}

/** jsdom приводит цвета к `rgb(...)`, браузер оставляет как записали — сравниваем по смыслу. */
function fillOf(path: SVGPathElement): string {
  return path.style.fill.toLowerCase()
}

/** Рендер + ждём, пока SVG фигуры загрузится. */
async function rendered(props: Partial<Parameters<typeof MuscleFigure>[0]> = {}) {
  const view = render(<MuscleFigure primary={[]} secondary={[]} {...props} />)

  await waitFor(() => expect(view.container.querySelector('svg')).not.toBeNull())
  return view
}

beforeEach(() => {
  stubFigureFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('normalizeFigureSvg: корень резиновый, пропорции и центрирование сохранены', () => {
  const result = normalizeFigureSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="22 0 156 400" width="156" height="400"><path d="M0 0" /></svg>',
  )

  expect(result.startsWith('<svg ')).toBe(true)
  expect(result).toContain('viewBox="22 0 156 400"')
  expect(result).toContain('width="100%"')
  expect(result).toContain('height="100%"')
  expect(result).toContain('preserveAspectRatio="xMidYMid meet"')
  expect(result).not.toContain('width="156"')
  expect(result.endsWith('<path d="M0 0" /></svg>')).toBe(true)
})

test('контейнер по центру, в пропорциях фигуры; SVG заполняет его', async () => {
  const { container } = await rendered()
  const canvas = canvasOf(container)

  expect(canvas.className).toContain('mx-auto')
  expect(canvas.className).toContain('w-full')
  expect(canvas.style.maxWidth).toBe('250px')
  expect(canvas.style.maxHeight).toBe('min(70vh, 640px)')
  expect(canvas.style.aspectRatio).toBe('156 / 400')

  const svg = canvas.querySelector('svg')
  expect(svg?.getAttribute('width')).toBe('100%')
  expect(svg?.getAttribute('height')).toBe('100%')
  expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
})

test('основная мышца подсвечена и пульсирует, помогающая — слабее и без пульса', async () => {
  const { container } = await rendered({ primary: ['chest'], secondary: ['biceps'] })

  const chest = musclePath(container, 'chest')
  const biceps = musclePath(container, 'biceps')

  expect(fillOf(chest)).toMatch(/^(#ff3b30|rgb\(255, 59, 48\))$/)
  expect(chest.classList.contains('muscle-pulse')).toBe(true)

  expect(fillOf(biceps)).toMatch(/^(#ff8a80|rgb\(255, 138, 128\))$/)
  expect(biceps.style.fillOpacity).toBe('0.7')
  expect(biceps.classList.contains('muscle-pulse')).toBe(false)

  // Мышца без состояния остаётся «спящей».
  expect(fillOf(musclePath(container, 'quads'))).toMatch(/^(#3a3a40|rgb\(58, 58, 64\))$/)
})

test('внутри мышцы живёт её название — видно при наведении и долгом нажатии', async () => {
  const { container } = await rendered({ primary: ['chest'] })

  expect(musclePath(container, 'chest').querySelector('title')?.textContent).toBe('Грудные')
  expect(musclePath(container, 'quads').querySelector('title')?.textContent).toBe('Квадрицепсы')
})

test('касание мышцы отдаёт её код', async () => {
  const onMuscleTap = vi.fn()
  const { container } = await rendered({ onMuscleTap })

  fireEvent.click(musclePath(container, 'chest'))

  expect(onMuscleTap).toHaveBeenCalledWith('chest')
})

test('зоны касания расширены прозрачными копиями под мышцами', async () => {
  const onMuscleTap = vi.fn()
  const { container } = await rendered({ onMuscleTap })

  await waitFor(() => expect(container.querySelector('[data-muscle-hit-layer]')).not.toBeNull())

  const layer = container.querySelector('[data-muscle-hit-layer]')
  // Слой ниже видимых мышц: точное попадание важнее «соседней» зоны.
  expect(layer?.nextElementSibling?.id).toBe('muscles')

  const hit = musclePath(container, 'chest', true)
  expect(hit.getAttribute('fill')).toBe('transparent')
  expect(hit.getAttribute('stroke')).toBe('transparent')
  expect(hit.getAttribute('stroke-width')).toBe('8')
  expect(hit.getAttribute('pointer-events')).toBe('all')
  // Копии не красим — они остаются невидимыми.
  expect(hit.getAttribute('style')).toBeNull()

  fireEvent.click(hit)
  expect(onMuscleTap).toHaveBeenCalledWith('chest')
})

test('фигуру без касаний копиями не утяжеляем', async () => {
  const { container } = await rendered()

  expect(container.querySelector('[data-muscle-hit-layer]')).toBeNull()
  expect(canvasOf(container).className).not.toContain('muscle-figure-interactive')
})

test('переключатель сторон и свайп работают без внешнего управления', async () => {
  const { container } = await rendered()
  const canvas = canvasOf(container)

  fireEvent.click(screen.getByRole('button', { name: 'Сзади' }))
  expect(pressed('Сзади')).toBe('true')
  await waitFor(() => expect(canvas.querySelector('[data-muscle="lats"]')).not.toBeNull())

  // Свайп влево — снова сзади, вправо — спереди.
  fireEvent.touchStart(canvas, { touches: [{ clientX: 300 }] })
  fireEvent.touchEnd(canvas, { changedTouches: [{ clientX: 100 }] })
  expect(pressed('Сзади')).toBe('true')

  fireEvent.touchStart(canvas, { touches: [{ clientX: 100 }] })
  fireEvent.touchEnd(canvas, { changedTouches: [{ clientX: 300 }] })
  expect(pressed('Спереди')).toBe('true')
})

test('сторону можно держать у родителя: `view` + `onViewChange`', async () => {
  const onViewChange = vi.fn()

  render(<MuscleFigure view="front" primary={[]} secondary={[]} onViewChange={onViewChange} />)
  await waitFor(() => expect(screen.getByRole('img').querySelector('svg')).not.toBeNull())

  fireEvent.click(screen.getByRole('button', { name: 'Сзади' }))

  expect(onViewChange).toHaveBeenCalledWith('back')
  // Родитель сторону не поменял — фигура осталась спереди.
  expect(pressed('Спереди')).toBe('true')
  expect(pressed('Сзади')).toBe('false')
})

test('сторона по умолчанию — там, где больше основных мышц', async () => {
  render(<MuscleFigure primary={['lats', 'traps-middle']} secondary={[]} />)

  await waitFor(() => expect(pressed('Сзади')).toBe('true'))
})
