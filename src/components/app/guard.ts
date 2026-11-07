export type GuardState = {
  hasSession: boolean
  onboardingDone: boolean
  hasAccess: boolean
  bypass: boolean
  path: string
}

export type GuardDecision = { redirect: string } | { allow: true }

/** Разделы, которые остаются доступными без подписки (история для чтения). */
function isReadOnlySection(path: string): boolean {
  return path === '/progress' || path.startsWith('/progress/') || path === '/profile'
}

/**
 * Решает, можно ли показать экран. Чистая функция — вся логика охраны маршрутов здесь.
 * `bypass` (владелец, тренер) пускает везде, включая экраны без анкеты.
 */
export function decideRoute(state: GuardState): GuardDecision {
  if (!state.hasSession) return { redirect: '/login' }
  if (state.bypass) return { allow: true }
  if (!state.onboardingDone) return { redirect: '/onboarding' }

  if (state.path === '/paywall') {
    return state.hasAccess ? { redirect: '/' } : { allow: true }
  }

  if (state.hasAccess) return { allow: true }
  if (isReadOnlySection(state.path)) return { allow: true }

  return { redirect: '/paywall' }
}
