'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Archive, MoreVertical, Pencil, Search } from 'lucide-react'
import { archiveConversationAction } from '@/app/(app)/app/(client)/coach/actions'

export type ConversationRow = {
  id: string
  title: string
  lastText: string
  lastAt: string
  hasPending: boolean
}

const TZ = 'Asia/Krasnoyarsk'
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)

/** Время в списке: сегодня — часы и минуты, иначе дата. */
function stamp(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return dayKey(date) === dayKey(now)
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(
        date,
      )
    : new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short' }).format(
        date,
      )
}

const normalize = (text: string) => text.toLowerCase().replace(/ё/g, 'е')

/** Список чатов в стиле мессенджера: поиск, архив, кнопка «Новый чат». */
export function ConversationList({ items }: { items: ConversationRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const needle = normalize(query.trim())
  const shown = needle ? items.filter((item) => normalize(item.title).includes(needle)) : items

  function archive(id: string) {
    setMenuFor(null)
    startTransition(async () => {
      const result = await archiveConversationAction(id)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[820px]">
      <header className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Link
          href="/"
          aria-label="Назад"
          className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary"
        >
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-[20px] font-semibold">МаксИИм</h1>
        <Link
          href="/coach/new"
          className="ml-auto hidden h-10 items-center gap-2 rounded-control bg-accent px-4 text-[14px] text-white lg:inline-flex"
        >
          <Pencil size={16} aria-hidden />
          Новый чат
        </Link>
      </header>

      <div className="px-4 pt-3">
        <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface-1 px-4">
          <Search size={16} className="text-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по чатам"
            aria-label="Поиск по чатам"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
        </label>
      </div>

      {error ? <p className="px-4 pt-2 text-[13px] text-danger">{error}</p> : null}

      <ul className="flex flex-1 flex-col pb-28 lg:pb-0">
        {shown.length === 0 ? (
          <li className="px-4 py-10 text-center text-[15px] text-text-secondary">
            {items.length === 0 ? 'Чатов пока нет — начни первый' : 'Ничего не нашлось'}
          </li>
        ) : null}

        {shown.map((item) => (
          <li key={item.id} className="relative border-b border-border/60">
            <Link href={`/coach/${item.id}`} className="flex items-center gap-3 px-4 py-3 pr-14">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[20px] text-white">
                М
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[16px] font-medium">{item.title}</span>
                  <span className="shrink-0 text-[12px] text-text-muted">{stamp(item.lastAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] text-text-secondary">{item.lastText}</span>
                  {item.hasPending ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
                      role="img"
                      aria-label="Есть предложение"
                    />
                  ) : null}
                </span>
              </span>
            </Link>

            <button
              type="button"
              aria-label="Действия с чатом"
              onClick={() => setMenuFor(menuFor === item.id ? null : item.id)}
              className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-text-muted"
            >
              <MoreVertical size={18} />
            </button>
            {menuFor === item.id ? (
              <button
                type="button"
                onClick={() => archive(item.id)}
                className="absolute top-1/2 right-12 z-10 flex h-11 -translate-y-1/2 items-center gap-2 rounded-control border border-border bg-surface-1 px-3 text-[14px]"
              >
                <Archive size={16} aria-hidden />В архив
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <Link
        href="/coach/new"
        aria-label="Новый чат"
        className="fixed right-4 bottom-[max(env(safe-area-inset-bottom),20px)] z-20 flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent text-white shadow-lg lg:hidden"
      >
        <Pencil size={22} />
      </Link>
    </div>
  )
}
