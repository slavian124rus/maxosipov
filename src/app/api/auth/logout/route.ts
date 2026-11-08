import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE } from '@/modules/auth'
import { appUrl } from '@/shared/app-url'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await destroySession(token)
  }
  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.redirect(appUrl('/login'), { status: 303 })
}
