import { formatShortDate } from '@/shared/dates'
import { formatWeight } from '@/modules/progression'

export type LineChartPoint = { x: Date; y: number }

type Props = {
  points: LineChartPoint[]
  unit?: string
  timezone?: string
  ariaLabel: string
}

const WIDTH = 320
const HEIGHT = 180
const PADDING = { top: 16, right: 12, bottom: 24, left: 8 }

/** «Красивые» границы оси Y с запасом 10 %. */
export function niceRange(values: number[]): { min: number; max: number } {
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return { min: 0, max: 1 }
  if (rawMin === rawMax) {
    const pad = Math.abs(rawMin) * 0.1 || 1
    return { min: rawMin - pad, max: rawMax + pad }
  }

  const pad = (rawMax - rawMin) * 0.1
  return { min: rawMin - pad, max: rawMax + pad }
}

/** Линия рабочего веса по датам: SVG без библиотек графиков. */
export function LineChart({ points, timezone = 'UTC', ariaLabel }: Props) {
  if (points.length === 0) return null

  const { min, max } = niceRange(points.map((point) => point.y))
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xAt = (index: number): number =>
    points.length === 1
      ? PADDING.left + innerWidth / 2
      : PADDING.left + (index / (points.length - 1)) * innerWidth

  const yAt = (value: number): number =>
    PADDING.top + innerHeight - ((value - min) / (max - min)) * innerHeight

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)} ${yAt(point.y)}`).join(' ')

  const last = points.at(-1)!
  const first = points[0]!
  const lastLabel = formatWeight(last.y)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 0.5, 1].map((fraction) => (
        <line
          key={fraction}
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + innerHeight * fraction}
          y2={PADDING.top + innerHeight * fraction}
          stroke="#2A2A2F"
          strokeWidth="1"
        />
      ))}

      {points.length > 1 ? (
        <path d={path} fill="none" stroke="#E5322D" strokeWidth="2" strokeLinecap="round" />
      ) : null}

      <circle cx={xAt(points.length - 1)} cy={yAt(last.y)} r={points.length === 1 ? 6 : 4} fill="#E5322D" />

      <text
        x={xAt(points.length - 1)}
        y={Math.max(PADDING.top + 10, yAt(last.y) - 10)}
        textAnchor="end"
        fill="#F5F5F7"
        fontSize="12"
      >
        {lastLabel}
      </text>

      <text x={PADDING.left} y={HEIGHT - 6} fill="#6B6B73" fontSize="11">
        {formatShortDate(first.x, timezone)}
      </text>
      <text x={WIDTH - PADDING.right} y={HEIGHT - 6} textAnchor="end" fill="#6B6B73" fontSize="11">
        {formatShortDate(last.x, timezone)}
      </text>
    </svg>
  )
}