import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'

// Меню «Ещё» зависит от сессии и прав.
export const instant = false

export default async function TrainerSettingsPage() {
  const { actor } = await requireUser()

  const items = [
    can(actor, 'settings.ai') ? { href: '/trainer/settings/ai', label: 'МаксИИм' } : null,
    can(actor, 'settings.progression')
      ? { href: '/trainer/settings/progression', label: 'Правила прогрессии' }
      : null,
    can(actor, 'settings.brand') ? { href: '/trainer/settings/brand', label: 'Бренд' } : null,
    can(actor, 'settings.brand') ? { href: '/trainer/settings/contacts', label: 'Контакты' } : null,
    can(actor, 'analytics.view') ? { href: '/trainer/settings/stats', label: 'Статистика' } : null,
    can(actor, 'subscriptions.grant')
      ? { href: '/trainer/subscriptions', label: 'Подписки' }
      : null,
    can(actor, 'subscriptions.grant')
      ? { href: '/trainer/settings/access', label: 'Пробный период и цена' }
      : null,
    can(actor, 'roles.manage') ? { href: '/trainer/settings/roles', label: 'Роли и права' } : null,
    can(actor, 'users.assign_roles')
      ? { href: '/trainer/settings/people', label: 'Люди' }
      : null,
    can(actor, 'roles.manage') ? { href: '/trainer/settings/audit', label: 'Журнал' } : null,
    can(actor, 'catalog.edit') || can(actor, 'catalog.publish')
      ? { href: '/trainer/machines', label: 'Тренажёры' }
      : null,
  ].filter((item): item is { href: string; label: string } => item !== null)

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Ещё</h1>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 items-center rounded-card border border-border bg-surface-1 px-4 text-[15px] text-text"
          >
            {item.label}
          </Link>
        ))}

        {/* Режим клиента: своя тренировка и дневник (план этапа 5). */}
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-card border border-dashed border-border px-4 text-[15px] text-text-secondary"
        >
          Мои тренировки
        </Link>
      </div>
    </main>
  )
}