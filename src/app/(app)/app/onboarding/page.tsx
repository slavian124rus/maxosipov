import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { OnboardingSteps } from './steps/onboarding-steps'

// Анкета зависит от сессии и user-agent.
export const instant = false

export default async function OnboardingPage() {
  const { user } = await requireUser()
  if (user.onboardingCompletedAt) redirect('/')

  const headerStore = await headers()
  const userAgent = headerStore.get('user-agent') ?? ''
  const isIos = /iPhone|iPad|iPod/.test(userAgent)

  return <OnboardingSteps isIos={isIos} askPhone={!user.phone} />
}

