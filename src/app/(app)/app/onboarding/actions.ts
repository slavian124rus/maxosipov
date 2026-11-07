'use server'

import { redirect } from 'next/navigation'
import { getAccessForUser } from '@/modules/access'
import { clientProfileSchema, getCurrentUser, saveOnboarding } from '@/modules/auth'

export type OnboardingState = {
  error: string | null
  done: boolean
  trialUntil: string | null
}

/** Дата в формате «7 декабря» по Красноярску. */
function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export async function saveOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const current = await getCurrentUser()
  if (!current) redirect('/login')

  const asNumber = (key: string): number =>
    Number(String(formData.get(key) ?? '').replace(',', '.'))

  const parsed = clientProfileSchema.safeParse({
    sex: String(formData.get('sex') ?? ''),
    birthYear: asNumber('birthYear'),
    heightCm: asNumber('heightCm'),
    weightKg: asNumber('weightKg'),
    goal: String(formData.get('goal') ?? ''),
    experience: String(formData.get('experience') ?? ''),
    sessionsPerWeek: asNumber('sessionsPerWeek'),
    limitations: String(formData.get('limitations') ?? '').trim() || null,
    healthConsent: formData.get('healthConsent') === 'on',
    pdConsent: formData.get('pdConsent') === 'on',
  })

  if (!parsed.success) {
    return { error: 'Проверь ответы — что-то заполнено неверно', done: false, trialUntil: null }
  }

  await saveOnboarding(current.user.id, parsed.data)

  const access = await getAccessForUser(current.user.id)
  const trialUntil = access.endsAt ? formatDateRu(access.endsAt) : null

  return { error: null, done: true, trialUntil }
}
