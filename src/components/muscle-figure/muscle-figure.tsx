'use client'

import { useEffect, useRef, useState } from 'react'
import { muscleName, type MuscleCode } from '@/modules/catalog'
import { defaultView, type FigureSide } from './state'

const IDLE_FILL = '#3A3A40'
const IDLE_STROKE = '#131316'
const PRIMARY_FILL = '#FF3B30'
const SECONDARY_FILL = '#FF8A80'

const sizes = { sm: 160, md: 240, lg: 320 } as const

/** SVG фигуры грузим один раз на сторону и держим в памяти модуля. */
const figureCache = new Map<FigureSide, Promise<string>>()

function loadFigure(view: FigureSide): Promise<string> {
  const cached = figureCache.get(view)
  if (cached) return cached

  const request = fetch(`/figure/${view}.svg`).then((response) => {
    if (!response.ok) throw new Error(`figure ${view}: ${response.status}`)
    return response.text()
  })

  figureCache.set(view, request)
  return request
}

export type MuscleFigureProps = {
  view?: FigureSide
  primary: MuscleCode[]
  secondary: MuscleCode[]
  onMuscleTap?: (code: MuscleCode) => void
  pulse?: boolean
  size?: keyof typeof sizes
}

/**
 * Фигура мышц: силуэт + слои мышц (DESIGN.md §6). Сторона переключается
 * сегментом «Спереди / Сзади» или свайпом по фигуре.
 */
export function MuscleFigure({
  view,
  primary,
  secondary,
  onMuscleTap,
  pulse = true,
  size = 'md',
}: MuscleFigureProps) {
  const [internalSide, setInternalSide] = useState<FigureSide | null>(null)
  const side = view ?? internalSide ?? defaultView(primary)
  const setSide = setInternalSide
  const [svg, setSvg] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

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

    for (const path of root.querySelectorAll<SVGPathElement>('[data-muscle]')) {
      const code = path.dataset.muscle as MuscleCode
      const isPrimary = primary.includes(code)
      const isSecondary = secondary.includes(code)

      path.style.fill = isPrimary ? PRIMARY_FILL : isSecondary ? SECONDARY_FILL : IDLE_FILL
      path.style.fillOpacity = isSecondary ? '0.7' : '1'
      path.style.stroke = IDLE_STROKE
      path.style.filter = isPrimary ? 'drop-shadow(0 0 3px rgba(255, 59, 48, 0.85))' : 'none'
      path.classList.toggle('muscle-pulse', isPrimary && pulse)
      path.style.cursor = onMuscleTap ? 'pointer' : 'default'
    }
  }, [svg, primary, secondary, pulse, onMuscleTap])

  const width = sizes[size]
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
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1 rounded-full border border-border bg-surface-1 p-1">
        {(['front', 'back'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSide(option)}
            aria-pressed={side === option}
            className={`rounded-full px-3 py-1 text-[13px] ${
              side === option ? 'bg-surface-2 text-text' : 'text-text-muted'
            }`}
          >
            {option === 'front' ? 'Спереди' : 'Сзади'}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        role="img"
        aria-label={label}
        style={{ width, height: (width * 400) / 156 }}
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
          setSide(end < start ? 'back' : 'front')
        }}
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
    </div>
  )
}
