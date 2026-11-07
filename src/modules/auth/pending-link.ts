import { eq, lt } from 'drizzle-orm'
import { db } from '@/shared/db'
import { pendingLinks, type PendingLinkData } from './schema'

const PENDING_TTL_MS = 15 * 60 * 1000

/** Запоминает профиль провайдера до подтверждения номера (15 минут). */
export async function createPendingLink(data: PendingLinkData): Promise<string> {
  const now = new Date()
  const [row] = await db
    .insert(pendingLinks)
    .values({
      provider: data.provider,
      providerUserId: data.providerUserId,
      name: data.name,
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: pendingLinks.id })

  if (!row) throw new Error('Не удалось сохранить привязку')
  return row.id
}

/** Забирает привязку один раз и только если она не истекла. */
export async function takePendingLink(id: string): Promise<PendingLinkData | null> {
  const [row] = await db.select().from(pendingLinks).where(eq(pendingLinks.id, id)).limit(1)
  if (!row) return null

  await db.delete(pendingLinks).where(eq(pendingLinks.id, id))

  if (row.expiresAt.getTime() <= Date.now()) return null

  return { provider: row.provider, providerUserId: row.providerUserId, name: row.name }
}

/** Чистит просроченные привязки (вызывается из воркера по расписанию). */
export async function cleanupPendingLinks(now: Date): Promise<number> {
  const deleted = await db
    .delete(pendingLinks)
    .where(lt(pendingLinks.expiresAt, now))
    .returning({ id: pendingLinks.id })
  return deleted.length
}
