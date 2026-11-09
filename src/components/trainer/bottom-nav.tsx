'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartColumn, Dumbbell, Ellipsis, PersonStanding, Users } from 'lucide-react'

export type TrainerNavItem = { href: string; label: string; icon: 'today' | 'clients' | 'programs' | 'exercises' | 'more' }

const ICONS = {
  today: ChartColumn,
  clients: Users,
  programs: Dumbbell,
  exercises: PersonStanding,
  more: Ellipsis,
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/trainer') return pathname === '/trainer'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Нижнее меню тренера (DESIGN.md §8.9). Пункты без прав не показываются. */
export function TrainerNav({ items }: { items: TrainerNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 z-20 mt-auto flex items-end justify-around border-t border-border bg-surface-1 px-2 pb-3 pt-2">
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const active = isActive(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-16 flex-col items-center gap-1 py-1 text-[11px] ${
              active ? 'text-text' : 'text-text-muted'
            }`}
          >
            <Icon size={22} strokeWidth={1.75} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}