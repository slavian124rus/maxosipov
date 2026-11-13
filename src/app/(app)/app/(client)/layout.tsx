import type { ReactNode } from 'react'
import { BottomNav } from '@/components/app/bottom-nav'
import { OfflineSync } from '@/components/app/offline-sync'

// Оболочка зависит от сессии (страницы внутри динамические).
export const instant = false

/**
 * Оболочка клиента: только нижнее меню. Доступ здесь НЕ проверяется —
 * layout не перерисовывается при переходах; охрана — в каждой странице
 * через `requireClientPage` (ARCHITECTURE.md §8.4).
 */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <OfflineSync />
      <BottomNav />
    </div>
  )
}
