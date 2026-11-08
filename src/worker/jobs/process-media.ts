import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { media } from '@/shared/db/schema'
import { processVideo } from '@/modules/media'

export type ProcessMediaData = { mediaId: string }

/**
 * Обработка одного ролика: `processing` → `ready` с путями или `failed` с текстом для Максима.
 * Ошибка подсветки мышц сюда не входит — она не роняет публикацию (этап 6).
 */
export async function processMediaJob(data: ProcessMediaData): Promise<void> {
  const [row] = await db.select().from(media).where(eq(media.id, data.mediaId)).limit(1)
  if (!row) throw new Error(`Файл ${data.mediaId} не найден`)
  // Повторная доставка задачи (истёк срок, дубль): готовый ролик не пересобираем.
  if (row.status === 'ready' && row.processedPaths?.mp4) return

  await db
    .update(media)
    .set({ status: 'processing', error: null, updatedAt: new Date() })
    .where(eq(media.id, row.id))

  try {
    const paths = await processVideo(row)
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
        error: `Не получилось обработать видео: ${message}`.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(media.id, row.id))
    throw error
  }
}
