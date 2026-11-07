import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createPkce, oauthCookieOptions, OAUTH_COOKIE, sealState, vk, yandex } from '@/modules/auth'
import { env } from '@/shared/env'

function isProvider(value: string): value is 'vk' | 'yandex' {
  return value === 'vk' || value === 'yandex'
}

/** Начинает вход: state + PKCE в подписанной cookie, затем редирект к провайдеру. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const loginUrl = new URL('/login?error=oauth', request.url)

  if (!isProvider(provider)) return NextResponse.redirect(loginUrl)

  const client = provider === 'vk' ? vk : yandex
  if (!client.isConfigured()) return NextResponse.redirect(loginUrl)

  const { verifier, challenge } = createPkce()
  const state = crypto.randomUUID()
  const redirectUri = `${env.APP_URL}/api/auth/${provider}/callback`

  const cookieStore = await cookies()
  cookieStore.set(
    OAUTH_COOKIE,
    sealState({ provider, verifier, state, createdAt: Date.now() }),
    oauthCookieOptions(),
  )

  return NextResponse.redirect(client.authorizeUrl(state, challenge, redirectUri))
}
