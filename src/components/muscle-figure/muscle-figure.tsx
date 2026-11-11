'use client'

import { useEffect, useRef, useState } from 'react'
import { muscleName, type MuscleCode } from '@/shared/muscles'
import { defaultView, type FigureSide } from './state'

const SVG_NS = 'http://www.w3.org/2000/svg'

const IDLE_FILL = '#3A3A40'
const IDLE_STROKE = '#131316'
const PRIMARY_FILL = '#FF3B30'
const SECONDARY_FILL = '#FF8A80'

/** viewBox фигуры — `22 0 156 400`: человек узкий и высокий, размеры контейнера считаем отсюда. */
const FIGURE_VIEW = { width: 156, height: 400 } as const

/** Насколько зона касания шире самого контура мышцы (в единицах viewBox, ≈1,6 px на единицу). */
const HIT_STROKE_WIDTH = 8

/**
 * Размер фигуры: максимальная ширина и потолок высоты. Потолок в `vh` — на телефоне человек
 * крупный и стоит по центру экрана, но не выдавливает остальное содержимое за пределы свайпа.
 */
const sizes = {
  sm: { width: 150, maxHeight: 'min(38vh, 340px)' },
  md: { width: 250, maxHeight: 'min(70vh, 640px)' },
  lg: { width: 300, maxHeight: 'min(78vh, 720px)' },
} as const

/** SVG фигуры грузим один раз на сторону и держим в памяти модуля. */
const figureCache = new Map<FigureSide, Promise<string>>()

/**
 * В файлах фигуры размер зашит числами (`width="156" height="400"`), поэтому человек
 * рисовался мелким в левом верхнем углу контейнера. Делаем корень резиновым: он заполняет
 * контейнер целиком, а `xMidYMid meet` держит пропорции и центрирует фигуру.
 */
export function normalizeFigureSvg(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/, (tag) => {
    const attrs = tag
      .slice(0, tag.endsWith('/>') ? -2 : -1)
      .replace(/\s(?:width|height|preserveAspectRatio|style)\s*=\s*"[^"]*"/gi, '')

    return `${attrs} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">`
  })
}

function loadFigure(view: FigureSide): Promise<string> {
  const cached = figureCache.get(view)
  if (cached) return cached

  const request = fetch(`/figure/${view}.svg`)
    .then((response) => {
      if (!response.ok) throw new Error(`figure ${view}: ${response.status}`)
      return response.text()
    })
    .then(normalizeFigureSvg)

  figureCache.set(view, request)
  return request
}

/** Название мышцы внутри `<path>` — браузер показывает его при наведении и долгом нажатии. */
function ensureTitle(path: SVGElement, text: string): void {
  let title: SVGTitleElement | null = path.querySelector<SVGTitleElement>('title')

  if (!title) {
    title = document.createElementNS(SVG_NS, 'title')
    path.prepend(title)
  }

  if (title.textContent !== text) title.textContent = text
}

/**
 * Прозрачные копии мышц с толстой обводкой — палец попадает в мышцу, даже если промахнулся
 * на пару миллиметров. Слой кладём ПОД видимые мышцы: точное попадание всегда важнее соседнего.
 */
function ensureHitLayer(root: HTMLElement): void {
  const svg = root.querySelector('svg')
  if (!svg || svg.querySelector('[data-muscle-hit-layer]')) return

  const layer = document.createElementNS(SVG_NS, 'g')
  layer.setAttribute('data-muscle-hit-layer', '')

  for (const path of svg.querySelectorAll<SVGPathElement>('[data-muscle]')) {
    const code = path.getAttribute('data-muscle')
    const contour = path.getAttribute('d')
    if (!code || !contour) continue

    const hit = document.createElementNS(SVG_NS, 'path')
    hit.setAttribute('d', contour)
    hit.setAttribute('data-muscle', code)
    hit.setAttribute('data-muscle-hit', '')
    hit.setAttribute('fill', 'transparent')
    hit.setAttribute('stroke', 'transparent')
    hit.setAttribute('stroke-width', String(HIT_STROKE_WIDTH))
    hit.setAttribute('pointer-events', 'all')
    layer.append(hit)
  }

  const muscles = svg.querySelector('#muscles')
  if (muscles) muscles.before(layer)
  else svg.prepend(layer)
}

export type MuscleFigureProps = {
  view?: FigureSide
  primary: MuscleCode[]
  secondary: MuscleCode[]
  onMuscleTap?: (code: MuscleCode) => void
  /** Сторона сменилась (переключатель или свайп) — нужно экранам со списком мышц рядом. */
  onViewChange?: (side: FigureSide) => void
  pulse?: boolean
  size?: keyof typeof sizes
}

/**
 * Фигура мышц: силуэт + слои мышц (DESIGN.md §6). Сторона переключается
 * сегментом «Спереди / Сзади» или свайпом по фигуре. Человек занимает весь контейнер
 * и стоит по центру; при `onMuscleTap` зоны касания мышц расширены.
 */
export function MuscleFigure({
  view,
  primary,
  secondary,
  onMuscleTap,
  onViewChange,
  pulse = true,
  size = 'md',
}: MuscleFigureProps) {
  const [internalSide, setInternalSide] = useState<FigureSide | null>(null)
  const side = view ?? internalSide ?? defaultView(primary)
  const [svg, setSvg] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  /** Без `view` сторона живёт внутри компонента; с `view` — решает родитель. */
  function changeSide(next: FigureSide): void {
    if (view === undefined) setInternalSide(next)
    onViewChange?.(next)
  }

  useEffect(() => {
    let cancelled = false

    loadFigure(side)
      .then((text) => {
        if (!cancelled) setSvg(text)
      })
      .catch(() => {
        if (!cancelled) setSvg(null)
      })

    return () => {
      cancelled = true
    }
  }, [side])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    for (const path of root.querySelectorAll<SVGPathElement>(
      '[data-muscle]:not([data-muscle-hit])',
    )) {
      const code = path.dataset.muscle as MuscleCode
      const isPrimary = primary.includes(code)
      const isSecondary = secondary.includes(code)

      path.style.fill = isPrimary ? PRIMARY_FILL : isSecondary ? SECONDARY_FILL : IDLE_FILL
      path.style.fillOpacity = isSecondary ? '0.7' : '1'
      path.style.stroke = IDLE_STROKE
      path.style.filter = isPrimary ? 'drop-shadow(0 0 3px rgba(255, 59, 48, 0.85))' : 'none'
      path.classList.toggle('muscle-pulse', isPrimary && pulse)
      path.style.cursor = onMuscleTap ? 'pointer' : 'default'
      ensureTitle(path, muscleName(code))
    }

    if (onMuscleTap) ensureHitLayer(root)
  }, [svg, primary, secondary, pulse, onMuscleTap])

  const canvas = sizes[size]
  const label = `Основные: ${primary.map(muscleName).join(', ') || 'нет'}; помогают: ${
    secondary.map(muscleName).join(', ') || 'нет'
  }`

  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!onMuscleTap) return
    const target = (event.target as Element).closest('[data-muscle]')
    const code = target?.getAttribute('data-muscle')
    if (code) onMuscleTap(code as MuscleCode)
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Вид фигуры"
        className="flex gap-1 rounded-full border border-border bg-surface-1 p-1"
      >
        {(['front', 'back'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => changeSide(option)}
            aria-pressed={side === option}
            className={`min-h-10 rounded-full px-4 py-1.5 text-[13px] ${
              side === option ? 'bg-surface-2 text-text' : 'text-text-muted'
            }`}
          >
            {option === 'front' ? 'Спереди' : 'Сзади'}
          </button>
        ))}
      </div>

      {/* Пропорции контейнера = пропорции фигуры, поэтому человек в нём крупнейший из возможных
          и стоит по центру; `max-height` не даёт фигуре занять весь экран телефона. */}
      <div
        ref={containerRef}
        role="img"
        aria-label={label}
        className={`mx-auto w-full touch-pan-y ${onMuscleTap ? 'muscle-figure-interactive' : ''}`}
        style={{
          maxWidth: canvas.width,
          maxHeight: canvas.maxHeight,
          aspectRatio: `${FIGURE_VIEW.width} / ${FIGURE_VIEW.height}`,
        }}
        onClick={handleClick}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current
          const end = event.changedTouches[0]?.clientX
          touchStartX.current = null
          if (start === null || end === undefined) return
          if (Math.abs(end - start) < 40) return
          changeSide(end < start ? 'back' : 'front')
        }}
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
    </div>
  )
}
