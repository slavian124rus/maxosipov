import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listClients, type ClientFilter } from '@/modules/trainer'
import { formatLongDate } from '@/shared/dates'

// Список зависит от сессии, прав и фильтров.
export const instant = false

const TZ = 'Asia/Krasnoyarsk'

const FILTERS: { value: ClientFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'trial', label: 'Пробные' },
  { value: 'active', label: 'С подпиской' },
  { value: 'expiring', label: 'Заканчиваются' },
  { value: 'expired', label: 'Без доступа' },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'К'
}

function accessLabel(access: { hasAccess: boolean; status: string; daysLeft: number | null }): {
  text: string
  tone: string
} {
  if (!access.hasAccess) return { text: 'Нет доступа', tone: 'text-danger' }
  if (access.status === 'trial') {
    return { text: `Пробный · ${access.daysLeft ?? 0} дн.`, tone: 'text-text-secondary' }
  }
  if ((access.daysLeft ?? 99) <= 7) {
    return { text: `Заканчивается · ${access.daysLeft ?? 0} дн.`, tone: 'text-warning' }
  }
  return { text: 'Подписка', tone: 'text-success' }
}

export default async function TrainerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q = '', filter = 'all' } = await searchParams
  const { actor } = await requireUser()
  if (!can(actor, 'clients.view')) notFound()

  const activeFilter: ClientFilter = FILTERS.some((item) => item.value === filter)
    ? (filter as ClientFilter)
    : 'all'

  const clients = await listClients(actor, { query: q, filter: activeFilter })
  const now = new Date()

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Клиенты</h1>

      <form className="flex gap-2">
        <input type="hidden" name="filter" value={activeFilter} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Имя или телефон"
          className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
        />
        <button type="submit" className="h-12 rounded-control bg-surface-2 px-4 text-[15px] text-text">
          Найти
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/trainer/clients?filter=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              activeFilter === item.value
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {clients.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Никого не нашёл</p>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((client) => {
            const label = accessLabel(client.access)

            return (
              <Link
                key={client.id}
                href={`/trainer/clients/${client.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface-1 px-3 py-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[15px] text-text-secondary">
                  {initials(client.name)}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] text-text">{client.name}</span>
                  <span className="text-[13px] text-text-muted">
                    {client.lastWorkoutAt
                      ? `последняя тренировка: ${formatLongDate(client.lastWorkoutAt, TZ, now)}`
                      : 'тренировок ещё не было'}
                  </span>
                </span>
                <span className={`text-[13px] ${label.tone}`}>{label.text}</span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}