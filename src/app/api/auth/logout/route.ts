import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { cookieDomainFor, destroySession, SESSION_COOKIE } from '@/modules/auth'
import { appUrl } from '@/shared/app-url'
import { env } from '@/shared/env'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await destroySession(token)
  }

  const response = NextResponse.redirect(appUrl('/login'), { status: 303 })

  // Куку стираем и без домена (старая, до admin.*), и с общим доменом — это разные куки.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const expired = `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`
  response.headers.append('Set-Cookie', expired)
  const domain = process.env.NODE_ENV === 'production' ? cookieDomainFor(env.APP_URL) : undefined
  if (domain) response.headers.append('Set-Cookie', `${expired}; Domain=${domain}`)

  return response
}
