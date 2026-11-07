import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/app/bottom-nav'
import { decideRoute } from '@/components/app/guard'
import { getAccessForUser } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'

// Оболочка клиента зависит от сессии и адреса.
export const instant = false

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers()
  const path = headerStore.get('x-pathname') ?? '/'

  const current = await getCurrentUser()
  const access = current ? await getAccessForUser(current.user.id) : null

  const decision = decideRoute({
    hasSession: Boolean(current),
    onboardingDone: Boolean(current?.user.onboardingCompletedAt),
    hasAccess: access?.hasAccess ?? false,
    bypass: access?.bypass ?? false,
    path,
  })

  if ('redirect' in decision) redirect(decision.redirect)

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </div>
  )
}
