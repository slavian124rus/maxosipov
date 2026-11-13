import Link from 'next/link'
import { ChevronRight, ClipboardList, ChartColumn, UserRound } from 'lucide-react'
import { requireClientPage } from '@/components/app/require-client-page'

// Экран зависит от сессии и подписки.
export const instant = false

const ROWS = [
  {
    href: '/plan',
    title: 'Мой план',
    hint: 'Подходы, отдых, вес и упражнения в твоей программе',
    icon: ClipboardList,
  },
  {
    href: '/progress',
    title: 'Прогресс',
    hint: 'Веса и тренировки по неделям',
    icon: ChartColumn,
  },
  {
    href: '/profile',
    title: 'Аккаунт',
    hint: 'Профиль, режим тренировки, уведомления, выход',
    icon: UserRound,
  },
]

/** Хаб «Настройки» (DESIGN.md §8.1): всё личное в одном месте, прогресс — на один тап глубже. */
export default async function SettingsPage() {
  await requireClientPage('/settings')

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Настройки</h1>
      <div className="flex flex-col gap-2">
        {ROWS.map(({ href, title, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface-1 px-4 py-3"
          >
            <Icon size={22} strokeWidth={1.75} className="shrink-0 text-text-secondary" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[17px]">{title}</span>
              <span className="text-[13px] text-text-muted">{hint}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </main>
  )
}
