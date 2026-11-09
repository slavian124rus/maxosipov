import { eq } from 'drizzle-orm'
import { can, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { media } from './schema'

/**
 * Медиа доступно владельцу или тому, кто может редактировать каталог.
 * Фото прогресса — персональные данные: чужие ссылки выдаёт только `listProgressPhotos`
 * после проверки права `clients.view_photos`, поэтому тренеру без этого права файл не отдаём.
 */
export async function assertCanAccessMedia(actor: Actor, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  if (!row) throw new Error('Файл не найден')

  if (row.ownerId === actor.id) return row

  if (row.kind === 'progress_photo') {
    if (!can(actor, 'clients.view_photos')) throw new Error('Нет доступа к файлу')
    return row
  }

  if (!can(actor, 'catalog.edit')) throw new Error('Нет доступа к файлу')

  return row
}
