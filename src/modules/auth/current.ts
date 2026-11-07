import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadActor, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users, type User } from './schema'
import { SESSION_COOKIE, validateSessionToken } from './session'

export type CurrentUser = { user: User; actor: Actor }

/** Текущий пользователь из cookie `sid` или `null`. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await validateSessionToken(token)
  if (!session) return null

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  if (!user || user.deletedAt) return null

  return { user, actor: await loadActor(user.id) }
}

/** То же, но без сессии отправляет на `/login`. */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  return current
}
