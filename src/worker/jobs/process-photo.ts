import { eq } from 'drizzle-orm'
import { processPhoto } from '@/modules/media'
import { db } from '@/shared/db'
import { media } from '@/shared/db/schema'

export type ProcessPhotoData = { mediaId: string }

/** Обработка фото прогресса: `processing` → `ready` с путями или `failed` с текстом. */
export async function processPhotoJob(data: ProcessPhotoData): Promise<void> {
  const [row] = await db.select().from(media).where(eq(media.id, data.mediaId)).limit(1)
  if (!row) throw new Error(`Файл ${data.mediaId} не найден`)

  // Повторная доставка готового фото — ничего не делаем.
  if (row.status === 'ready') return

  await db
    .update(media)
    .set({ status: 'processing', error: null, updatedAt: new Date() })
    .where(eq(media.id, row.id))

  try {
    const paths = await processPhoto(row)
    await db
      .update(media)
      .set({ status: 'ready', processedPaths: paths, error: null, updatedAt: new Date() })
      .where(eq(media.id, row.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'неизвестная ошибка'
    await db
      .update(media)
      .set({
        status: 'failed',
        error: `Не получилось обработать фото: ${message}`.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(media.id, row.id))
    throw error
  }
}