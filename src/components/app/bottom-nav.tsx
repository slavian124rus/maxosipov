'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Home, MessageCircle, PersonStanding, Settings } from 'lucide-react'

const ITEMS = [
  { href: '/', label: 'Сегодня', icon: Home },
  { href: '/workouts', label: 'Тренировки', icon: Dumbbell },
  { href: '/exercises', label: 'Упражнения', icon: PersonStanding },
  { href: '/settings', label: 'Настройки', icon: Settings, also: ['/plan', '/progress', '/profile'] },
]

function isActive(pathname: string, href: string, also: string[] = []): boolean {
  if (href === '/') return pathname === '/'
  return [href, ...also].some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/** Нижнее меню клиента (DESIGN.md §8.1). */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 z-20 mt-auto flex items-end justify-between border-t border-border bg-surface-1 px-4 pb-3 pt-2">
      {ITEMS.slice(0, 2).map((item) => (
        <NavItem key={item.href} {...item} active={isActive(pathname, item.href, 'also' in item ? item.also : [])} />
      ))}

      <Link
        href="/coach"
        aria-label="МаксИИм"
        className="-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-accent text-white"
      >
        <MessageCircle size={26} strokeWidth={1.75} />
      </Link>

      {ITEMS.slice(2).map((item) => (
        <NavItem key={item.href} {...item} active={isActive(pathname, item.href, 'also' in item ? item.also : [])} />
      ))}
    </nav>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex w-16 flex-col items-center gap-1 py-1 text-[11px] ${
        active ? 'text-text' : 'text-text-muted'
      }`}
    >
      <Icon size={22} strokeWidth={1.75} />
      {label}
    </Link>
  )
}
