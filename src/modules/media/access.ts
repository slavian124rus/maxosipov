import { eq } from 'drizzle-orm'
import { can, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { media } from './schema'

/** Медиа доступно владельцу или тому, кто может редактировать каталог. */
export async function assertCanAccessMedia(actor: Actor, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  if (!row) throw new Error('Файл не найден')

  if (row.ownerId !== actor.id && !can(actor, 'catalog.edit')) {
    throw new Error('Нет доступа к файлу')
  }

  return row
}
