import type { ReactNode } from 'react'

/**
 * Общий контейнер поверхностей `app.*`: ширину задаёт каждая поверхность сама.
 * Приложение клиента — узкая мобильная колонка (`(client)/layout.tsx`),
 * кабинет тренера на ПК — боковое меню и широкое полотно (`trainer/layout.tsx`).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh w-full flex-col">{children}</div>
}
