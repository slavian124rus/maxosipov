import { eq } from 'drizzle-orm'
import { can, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { progressPhotos, users } from '@/shared/db/schema'
import { media } from './schema'

/**
 * Медиа доступно владельцу или тому, кто может редактировать каталог.
 * Фото прогресса — персональные данные: чужие ссылки выдаёт только `listProgressPhotos`
 * после проверки права `clients.view_photos`, поэтому тренеру без этого права файл не отдаём.
 */
export async function assertCanAccessMedia(
  actor: Actor,
  id: string,
  options: { write?: boolean } = {},
) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  if (!row) throw new Error('Файл не найден')

  if (row.ownerId === actor.id) return row

  if (row.kind === 'progress_photo') {
    // Загружает и дописывает файл только владелец; чужое фото тренер лишь смотрит.
    if (options.write) throw new Error('Нет доступа к файлу')

    // Право учитывает, чей клиент: «только свои» не открывает фото чужих клиентов.
    const [attached] = await db
      .select({ userId: progressPhotos.userId })
      .from(progressPhotos)
      .where(eq(progressPhotos.mediaId, row.id))
      .limit(1)
    if (!attached) throw new Error('Нет доступа к файлу')

    const [client] = await db.select().from(users).where(eq(users.id, attached.userId)).limit(1)
    if (!client) throw new Error('Нет доступа к файлу')

    if (!can(actor, 'clients.view_photos', { clientId: client.id, clientTrainerId: client.trainerId })) {
      throw new Error('Нет доступа к файлу')
    }
    return row
  }

  if (!can(actor, 'catalog.edit')) throw new Error('Нет доступа к файлу')

  return row
}
