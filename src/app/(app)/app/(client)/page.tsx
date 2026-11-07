import Link from 'next/link'
import { requireUser } from '@/modules/auth'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Я'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function TodayPage() {
  const { user } = await requireUser()

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-muted">Сегодня</p>
          <h1 className="text-[22px] font-semibold">Привет, {user.name || 'друг'}</h1>
        </div>
        <Link
          href="/profile"
          aria-label="Профиль"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-[15px] text-text-secondary"
        >
          {initials(user.name)}
        </Link>
      </header>

      <p className="text-[15px] text-text-secondary">
        Тренировка на сегодня появится здесь, когда Максим назначит программу.
      </p>
    </main>
  )
}
