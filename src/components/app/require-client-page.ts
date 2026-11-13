import { redirect } from 'next/navigation'
import { getAccessForUser } from '@/modules/access'
import { getCurrentUser, type CurrentUser } from '@/modules/auth'
import { appUrl } from '@/shared/app-url'
import { decideRoute } from './guard'

/** Пути клиентских экранов: охрана получает путь от страницы, а не из заголовков запроса. */
export type ClientPath =
  | '/'
  | '/workout'
  | '/workouts'
  | '/coach'
  | '/exercises'
  | '/progress'
  | '/profile'
  | '/settings'
  | '/plan'
  | '/paywall'

/**
 * Охрана клиентского экрана (ARCHITECTURE.md §8.4). Вызывается первой строкой
 * в каждой странице — layout в App Router не перерисовывается при переходах,
 * поэтому охранять в нём нельзя.
 */
export async function requireClientPage(path: ClientPath): Promise<CurrentUser> {
  const current = await getCurrentUser()
  const access = current ? await getAccessForUser(current.user.id) : null

  const decision = decideRoute({
    hasSession: Boolean(current),
    onboardingDone: Boolean(current?.user.onboardingCompletedAt),
    hasAccess: access?.hasAccess ?? false,
    bypass: access?.bypass ?? false,
    path,
  })

  if ('redirect' in decision) redirect(appUrl(decision.redirect).toString())
  return current!
}
