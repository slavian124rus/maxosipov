'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChartColumn,
  ClipboardList,
  Dumbbell,
  Home,
  MessageCircle,
  PersonStanding,
  Settings,
} from 'lucide-react'

const ITEMS = [
  { href: '/', label: 'Сегодня', hint: 'Тренировка на сегодня', icon: Home },
  {
    href: '/workouts',
    label: 'Тренировки',
    hint: 'Программа и история',
    icon: Dumbbell,
    also: ['/workout'],
  },
  {
    href: '/exercises',
    label: 'Упражнения',
    hint: 'Каталог зала «Колизей»',
    icon: PersonStanding,
  },
  {
    href: '/coach',
    label: 'МаксИИм',
    hint: 'ИИ-помощник Максима',
    icon: MessageCircle,
    accent: true,
  },
  { href: '/progress', label: 'Прогресс', hint: 'Веса, замеры и фото', icon: ChartColumn },
  { href: '/plan', label: 'Мой план', hint: 'Дни, подходы и отдых', icon: ClipboardList },
  {
    href: '/settings',
    label: 'Настройки',
    hint: 'Профиль и уведомления',
    icon: Settings,
  },
] as const

function isActive(pathname: string, href: string, also: readonly string[] = []): boolean {
  if (href === '/') return pathname === '/'
  return [href, ...also].some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Я'

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Боковое меню клиента на ПК (DESIGN.md §8.1). На телефоне его нет —
 * нижнее меню остаётся основным. Ссылка ведёт на профиль, как аватар в шапке.
 */
export function ClientSideNav({
  gymName,
  userName,
  contact,
}: {
  gymName: string
  userName: string
  contact: string
}) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface-1 lg:flex">
      <Link href="/" className="flex flex-col gap-1 px-5 pt-7 pb-6">
        <span className="truncate font-display text-[22px] leading-none font-medium tracking-wide">
          {gymName}
        </span>
        <span className="text-[13px] text-text-muted">Тренировки с Максимом</span>
      </Link>

      <nav
        aria-label="Разделы приложения"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href, 'also' in item ? item.also : [])
          const accent = 'accent' in item && item.accent

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors duration-150 ${
                active
                  ? 'bg-surface-2 text-text'
                  : 'text-text-secondary hover:bg-surface-2/60 hover:text-text'
              }`}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-accent"
                />
              ) : null}
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control ${
                  accent
                    ? 'bg-accent text-white'
                    : active
                      ? 'bg-surface-1 text-accent'
                      : 'bg-surface-1'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px]">{item.label}</span>
                <span className="truncate text-[12px] text-text-muted">{item.hint}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <Link
          href="/profile"
          aria-current={pathname === '/profile' ? 'page' : undefined}
          className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-surface-2/60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] text-text-secondary">
            {initials(userName)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] text-text">{userName || 'Профиль'}</span>
            <span className="truncate text-[12px] text-text-muted">
              {contact || 'Аккаунт и настройки'}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  )
}
