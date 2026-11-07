import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'

// Кабинет тренера зависит от сессии и прав.
export const instant = false

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const { actor } = await requireUser()

  const allowed = can(actor, 'subscriptions.grant') || can(actor, 'clients.view')
  if (!allowed) notFound()

  return <div className="flex min-h-dvh flex-col">{children}</div>
}
