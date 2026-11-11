'use client'

import { ChevronRight, Search, X } from 'lucide-react'
import { splitMatches } from '@/components/trainer/catalog-tree'

/** Подсветка совпадений поиска: «<mark>тяга</mark> верхнего блока». */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitMatches(text, query).map((part, index) =>
        part.hit ? (
          <mark
            key={`${index}-${part.text}`}
            className="rounded-[4px] bg-accent/30 px-0.5 text-text"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

/** Строка поиска по дереву: иконка, кнопка очистки, подпись результата. */
export function TreeSearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="relative">
      <Search
        size={18}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-12 w-full rounded-control border border-border bg-surface-1 pr-11 pl-10 text-[15px] text-text outline-none focus-visible:border-accent"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Очистить поиск"
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}

/** Шеврон ветки: повёрнут вниз, когда ветка раскрыта. */
export function BranchChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={18}
      strokeWidth={1.75}
      aria-hidden
      className={`shrink-0 text-text-muted transition-transform duration-150 ${
        open ? 'rotate-90' : ''
      }`}
    />
  )
}

/** Счётчик в ветке: «4» в кружке, чтобы дерево читалось без раскрытия. */
export function BranchCount({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span
      className={`tabular-nums ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-text-secondary ${className}`}
    >
      {count}
    </span>
  )
}

/** Шапка дерева-таблицы: видна только на ПК, колонки совпадают со строками. */
export function TreeTableHead({
  first,
  second,
  third,
}: {
  first: string
  second: string
  third?: string
}) {
  return (
    <div className="hidden grid-cols-[minmax(0,1fr)_180px_150px] items-center gap-3 rounded-t-card border border-border bg-surface-2/40 px-3 py-2 text-[12px] tracking-wide text-text-muted uppercase lg:grid">
      <span>{first}</span>
      <span>{second}</span>
      <span>{third}</span>
    </div>
  )
}

