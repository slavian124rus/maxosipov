import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  createPendingLink,
  createSession,
  OAUTH_COOKIE,
  openState,
  SESSION_COOKIE,
  sessionCookieOptions,
  signInWithVerifiedPhone,
  vk,
  yandex,
  type OAuthProfile,
} from '@/modules/auth'
import { env } from '@/shared/env'

function isProvider(value: string): value is 'vk' | 'yandex' {
  return value === 'vk' || value === 'yandex'
}

/** Завершает вход: проверяет state, обменивает код, входит или просит подтвердить номер. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const url = new URL(request.url)
  const fail = NextResponse.redirect(new URL('/login?error=oauth', request.url))

  if (!isProvider(provider)) return fail

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const deviceId = url.searchParams.get('device_id')

  const cookieStore = await cookies()
  const sealed = cookieStore.get(OAUTH_COOKIE)?.value
  cookieStore.delete(OAUTH_COOKIE)

  const saved = sealed ? openState(sealed) : null
  if (!code || !saved || saved.provider !== provider || saved.state !== state) return fail

  const redirectUri = `${env.APP_URL}/api/auth/${provider}/callback`

  let profile: OAuthProfile
  try {
    profile =
      provider === 'vk'
        ? await vk.exchange({ code, verifier: saved.verifier, redirectUri, deviceId, state })
        : await yandex.exchange(code, saved.verifier, redirectUri)
  } catch (error) {
    console.error('[oauth] обмен кода не удался', error)
    return fail
  }

  if (!profile.phone) {
    const linkId = await createPendingLink({
      provider,
      providerUserId: profile.providerUserId,
      name: profile.name,
    })
    return NextResponse.redirect(new URL(`/login/phone?link=${linkId}`, request.url))
  }

  const { userId, isNew } = await signInWithVerifiedPhone(profile.phone, {
    provider,
    providerUserId: profile.providerUserId,
    ...(profile.name ? { name: profile.name } : {}),
  })

  const userAgent = request.headers.get('user-agent')
  const { token, expiresAt } = await createSession(userId, userAgent)
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))

  return NextResponse.redirect(new URL(isNew ? '/onboarding' : '/', request.url))
}
