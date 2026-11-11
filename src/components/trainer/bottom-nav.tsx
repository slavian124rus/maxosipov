'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ICONS } from '@/components/trainer/nav-icons'
import { isNavActive, mobileNavItems, type TrainerNavItem } from '@/components/trainer/nav-items'

/**
 * Нижнее меню тренера (DESIGN.md §8.9) — только на телефоне. На ПК его заменяет
 * боковое меню (`TrainerSidebar`), поэтому здесь `lg:hidden`.
 */
export function TrainerNav({ items }: { items: TrainerNavItem[] }) {
  const pathname = usePathname()
  const mobile = mobileNavItems(items)

  return (
    <nav className="sticky bottom-0 z-20 mt-auto flex items-end justify-around border-t border-border bg-surface-1 px-2 pt-2 pb-3 lg:hidden">
      {mobile.map((item) => {
        const Icon = NAV_ICONS[item.icon]
        const active = isNavActive(pathname, item.href)

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
