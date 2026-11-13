import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { BottomNav } from '@/components/app/bottom-nav'
import { ClientSideNav } from '@/components/app/client-side-nav'
import { OfflineSync } from '@/components/app/offline-sync'
import { formatContact, getCurrentUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'

// Оболочка зависит от сессии (страницы внутри динамические).
export const instant = false

/**
 * Оболочка клиента (DESIGN.md §8.1): на телефоне — узкая колонка и нижнее меню,
 * на ПК — боковое меню и широкое полотно. Доступ здесь НЕ проверяется — layout
 * не перерисовывается при переходах; охрана — в каждой странице через
 * `requireClientPage` (ARCHITECTURE.md §8.4).
 */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  // Меню показывает зал и имя клиента, то есть читает БД. Без `connection()`
  // Next пытается выполнить layout при сборке (prerender) — там базы нет,
  // и `pnpm build` в Docker падает с ECONNREFUSED. Явно уходим в динамику.
  await connection()

  const [current, gym] = await Promise.all([getCurrentUser(), getGym()])
  const user = current?.user

  return (
    <div className="flex min-h-dvh w-full flex-col lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      <ClientSideNav
        gymName={gym.name}
        userName={user?.name ?? ''}
        contact={user ? formatContact(user.phone ?? user.email ?? '') : ''}
      />

      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col lg:mx-0 lg:max-w-none">
        <div className="flex flex-1 flex-col lg:px-10 lg:py-8 xl:px-14">
          <div className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[1180px]">{children}</div>
        </div>
        <OfflineSync />
        <BottomNav />
      </div>
    </div>
  )
}
