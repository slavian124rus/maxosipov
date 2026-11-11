'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { TrainerNav } from '@/components/trainer/bottom-nav'
import { NAV_ICONS } from '@/components/trainer/nav-icons'
import { isNavActive, type TrainerNavItem } from '@/components/trainer/nav-items'

type Props = {
  items: TrainerNavItem[]
  gymName: string
  user: { name: string; contact: string }
  /** Адрес приложения клиента: на `admin.*` ссылка «/» вернулась бы в кабинет. */
  clientAppUrl: string
  children: ReactNode
}

/**
 * Каркас кабинета (DESIGN.md §8.9): на телефоне — нижнее меню, на ПК — боковое меню
 * и широкое полотно. Один и тот же DOM, переключение только стилями (`lg:`),
 * чтобы серверный рендер и гидратация совпадали на любом экране.
 */
export function TrainerShell({ items, gymName, user, clientAppUrl, children }: Props) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface-1 lg:flex">
        <div className="flex flex-col gap-1 px-5 pt-7 pb-6">
          <span className="font-display text-[22px] leading-none font-medium tracking-wide">
            {gymName}
          </span>
          <span className="text-[13px] text-text-muted">Кабинет тренера</span>
        </div>

        <nav aria-label="Разделы кабинета" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon]
            const active = isNavActive(pathname, item.href)

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
                <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px]">{item.label}</span>
                  {item.hint ? (
                    <span className="truncate text-[12px] text-text-muted">{item.hint}</span>
                  ) : null}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[15px] text-text">{user.name}</span>
            <span className="truncate text-[13px] text-text-muted">{user.contact}</span>
          </div>
          <a
            href={clientAppUrl}
            className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-text"
          >
            Приложение клиента
            <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <TrainerNav items={items} />
      </div>
    </div>
  )
}
