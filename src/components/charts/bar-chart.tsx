import { formatWeight } from '@/modules/progression'

export type BarChartItem = { label: string; value: number }

type Props = {
  bars: BarChartItem[]
  ariaLabel: string
}

const HEIGHT = 140
const NBSP = '\u00A0'

/** «4 320» — тысячи через неразрывный пробел. */
export function formatThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Столбцы объёма по неделям: подписаны максимум и последнее значение. */
export function BarChart({ bars, ariaLabel }: Props) {
  if (bars.length === 0) return null

  const max = Math.max(...bars.map((bar) => bar.value), 1)
  const last = bars.at(-1)!

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-1" style={{ height: HEIGHT }}>
        {bars.map((bar, index) => (
          <div key={`${bar.label}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-t-[4px] ${bar.value === max ? 'bg-accent' : 'bg-surface-2'}`}
              style={{ height: `${Math.max(2, (bar.value / max) * (HEIGHT - 20))}px` }}
              title={`${bar.label}: ${formatWeight(bar.value)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-text-muted">
        <span>{bars[0]?.label}</span>
        <span>
          {last.label}: {formatWeight(last.value)}
        </span>
      </div>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}