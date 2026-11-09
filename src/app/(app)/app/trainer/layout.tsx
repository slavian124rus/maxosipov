import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { TrainerNav, type TrainerNavItem } from '@/components/trainer/bottom-nav'

// Кабинет тренера зависит от сессии и прав.
export const instant = false

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const { actor } = await requireUser()

  const items: TrainerNavItem[] = [{ href: '/trainer', label: 'Сегодня', icon: 'today' }]

  if (can(actor, 'clients.view')) items.push({ href: '/trainer/clients', label: 'Клиенты', icon: 'clients' })
  if (can(actor, 'clients.edit_programs')) {
    items.push({ href: '/trainer/programs', label: 'Программы', icon: 'programs' })
  }
  if (can(actor, 'catalog.edit') || can(actor, 'catalog.publish')) {
    items.push({ href: '/trainer/exercises', label: 'Упражнения', icon: 'exercises' })
  }
  items.push({ href: '/trainer/settings', label: 'Ещё', icon: 'more' })

  const allowed =
    can(actor, 'subscriptions.grant') ||
    can(actor, 'clients.view') ||
    can(actor, 'catalog.edit') ||
    can(actor, 'analytics.view')
  if (!allowed) notFound()

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TrainerNav items={items} />
    </div>
  )
}
