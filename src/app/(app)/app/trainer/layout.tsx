import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { formatContact, requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { env } from '@/shared/env'
import { TrainerShell } from '@/components/trainer/trainer-shell'
import { trainerNavItems } from '@/components/trainer/nav-config'

// Кабинет тренера зависит от сессии и прав.
export const instant = false

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const { user, actor } = await requireUser()

  const allowed =
    can(actor, 'subscriptions.grant') ||
    can(actor, 'clients.view') ||
    can(actor, 'catalog.edit') ||
    can(actor, 'analytics.view')
  if (!allowed) notFound()

  const [gym, items] = await Promise.all([getGym(), Promise.resolve(trainerNavItems(actor))])

  return (
    <TrainerShell
      items={items}
      gymName={gym.name}
      user={{ name: user.name, contact: formatContact(user.phone ?? user.email ?? '') }}
      clientAppUrl={env.APP_URL}
    >
      {children}
    </TrainerShell>
  )
}

