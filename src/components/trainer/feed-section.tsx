import type { ReactNode } from 'react'

type Props = {
  title: string
  count?: number
  tone?: 'normal' | 'danger'
  children: ReactNode
}

/** Секция ленты «Сегодня» (DESIGN.md §8.9): заголовок с числом и содержимое. */
export function FeedSection({ title, count, tone = 'normal', children }: Props) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-card border px-4 py-3 ${
        tone === 'danger' ? 'border-danger/50 bg-surface-1' : 'border-border bg-surface-1'
      }`}
    >
      <h2 className={`text-[15px] font-semibold ${tone === 'danger' ? 'text-danger' : 'text-text'}`}>
        {title}
        {typeof count === 'number' ? ` · ${count}` : ''}
      </h2>
      {children}
    </section>
  )
}