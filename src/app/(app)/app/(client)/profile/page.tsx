import { getAccessForUser } from '@/modules/access'
import { formatPhone, requireUser } from '@/modules/auth'

/** Дата в формате «7 декабря» по Красноярску. */
function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function accessLabel(status: string, endsAt: Date | null, hasAccess: boolean): string {
  if (status === 'trial' && hasAccess && endsAt) return `Пробный период до ${formatDateRu(endsAt)}`
  if (status === 'active' && hasAccess && endsAt) return `Подписка до ${formatDateRu(endsAt)}`
  if (status === 'frozen') return 'Подписка заморожена'
  return 'Подписка закончилась'
}

export default async function ProfilePage() {
  const { user } = await requireUser()
  const access = await getAccessForUser(user.id)

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Профиль</h1>

      <div className="flex flex-col gap-1">
        <p className="text-[17px]">{user.name || 'Без имени'}</p>
        <p className="text-[15px] text-text-secondary">{formatPhone(user.phone)}</p>
        <p className="text-[15px] text-text-secondary">
          {accessLabel(access.status, access.endsAt, access.hasAccess)}
        </p>
      </div>

      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="h-12 w-full rounded-control border border-border bg-surface-1 text-[15px] text-text"
        >
          Выйти
        </button>
      </form>
    </main>
  )
}
