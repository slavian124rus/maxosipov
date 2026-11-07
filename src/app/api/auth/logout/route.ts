import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE } from '@/modules/auth'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await destroySession(token)
  }
  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
