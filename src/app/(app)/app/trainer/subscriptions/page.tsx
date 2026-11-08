import { listSubscriptionsForActor, type SubscriptionFilter } from '@/modules/access'
import { formatPhone, requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { notFound } from 'next/navigation'
import { SubscriptionsList, type SubscriptionRowView } from './subscriptions-list'

// Список зависит от сессии и фильтров.
export const instant = false

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'trial', label: 'Пробные' },
  { value: 'ending', label: 'Заканчиваются (7 дней)' },
  { value: 'expired', label: 'Истекли' },
] as const

const EVENT_LABELS: Record<string, string> = {
  trial_started: 'пробный период',
  granted: 'подписка выдана',
  frozen: 'заморожена',
  unfrozen: 'разморожена',
  disabled: 'отключена',
  expired: 'истекла',
}

function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function statusLabel(status: string, hasAccess: boolean): string {
  if (status === 'trial') return hasAccess ? 'Пробный' : 'Пробный истёк'
  if (status === 'active') return hasAccess ? 'Подписка' : 'Подписка истекла'
  if (status === 'frozen') return 'Заморожена'
  if (status === 'disabled') return 'Отключена'
  if (status === 'expired') return 'Истекла'
  return 'Нет подписки'
}

export default async function TrainerSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q = '', filter = 'all' } = await searchParams
  const { actor } = await requireUser()
  if (!can(actor, 'subscriptions.grant')) notFound()
  const gym = await getGym()

  const activeFilter: SubscriptionFilter = FILTERS.some((item) => item.value === filter)
    ? (filter as SubscriptionFilter)
    : 'all'

  // Только клиенты, которых актор вправе видеть (ревью F3).
  const items = await listSubscriptionsForActor(actor, { query: q, filter: activeFilter })

  const view: SubscriptionRowView[] = items.map(({ userId, name, phone, access, events }) => ({
    id: userId,
    name,
    phone: formatPhone(phone),
    statusLabel: statusLabel(access.status, access.hasAccess),
    endsAtLabel: access.endsAt ? formatDateRu(access.endsAt) : null,
    tone: !access.hasAccess ? 'danger' : (access.daysLeft ?? 99) <= 7 ? 'warning' : 'normal',
    isFrozen: access.status === 'frozen',
    history: events.map((event) => ({
      id: event.id,
      label: EVENT_LABELS[event.type] ?? event.type,
      date: formatDateRu(event.createdAt),
    })),
  }))

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Подписки</h1>

      <form className="flex gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Имя или телефон"
          className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
        />
        <button
          type="submit"
          className="h-12 rounded-control bg-surface-2 px-4 text-[15px] text-text"
        >
          Найти
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <a
            key={item.value}
            href={`/trainer/subscriptions?filter=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              activeFilter === item.value
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <SubscriptionsList rows={view} defaultPrice={gym.settings.subscriptionPriceRub} />

      <a href="/trainer/settings/access" className="text-[15px] text-accent underline-offset-4 hover:underline">
        Настройки доступа
      </a>
    </main>
  )
}
