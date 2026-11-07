import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { computeAccess, subscriptionEvents, subscriptions } from '@/modules/access'
import { formatPhone } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { roles } from '@/modules/rbac'
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
  const gym = await getGym()
  const now = new Date()

  const rows = await db
    .select({ user: users, sub: subscriptions })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(and(eq(roles.name, 'Клиент'), isNull(users.deletedAt)))
    .orderBy(users.name)

  const events = await db
    .select()
    .from(subscriptionEvents)
    .orderBy(desc(subscriptionEvents.createdAt))

  const query = q.trim().toLowerCase()
  const queryDigits = q.replace(/\D/g, '')

  const view: SubscriptionRowView[] = []

  for (const { user, sub } of rows) {
    const access = computeAccess(sub, now)

    if (query) {
      const matchesName = user.name.toLowerCase().includes(query)
      const matchesPhone = queryDigits ? user.phone.includes(queryDigits) : false
      if (!matchesName && !matchesPhone) continue
    }

    if (filter === 'trial' && access.status !== 'trial') continue
    if (filter === 'expired' && access.status !== 'expired') continue
    if (filter === 'ending' && !(access.hasAccess && (access.daysLeft ?? 99) <= 7)) continue

    const tone: SubscriptionRowView['tone'] = !access.hasAccess
      ? 'danger'
      : (access.daysLeft ?? 99) <= 7
        ? 'warning'
        : 'normal'

    view.push({
      id: user.id,
      name: user.name,
      phone: formatPhone(user.phone),
      statusLabel: statusLabel(access.status, access.hasAccess),
      endsAtLabel: access.endsAt ? formatDateRu(access.endsAt) : null,
      tone,
      isFrozen: access.status === 'frozen',
      history: events
        .filter((event) => event.userId === user.id)
        .slice(0, 10)
        .map((event) => ({
          id: event.id,
          label: EVENT_LABELS[event.type] ?? event.type,
          date: formatDateRu(event.createdAt),
        })),
    })
  }

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
              filter === item.value
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
