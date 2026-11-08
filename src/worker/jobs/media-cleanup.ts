import { rm } from 'node:fs/promises'
import { and, eq, isNull, lte, ne } from 'drizzle-orm'
import { mediaDir, mediaRoot, safeJoin } from '@/modules/media'
import { db } from '@/shared/db'
import { media } from '@/shared/db/schema'

const KEEP_DAYS = 30
const ABANDONED_DAYS = 3

/** Удаляет исходники обработанных видео старше 30 дней (ARCHITECTURE.md §13). */
export async function cleanupOriginals(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000)

  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.status, 'ready'), lte(media.updatedAt, cutoff)))

  let removed = 0

  for (const row of rows) {
    if (!row.originalPath) continue

    try {
      await rm(safeJoin(mediaRoot(), row.originalPath), { force: true })
    } catch (error) {
      console.error('[media.cleanup] не удалось удалить исходник', row.id, error)
      continue
    }

    await db
      .update(media)
      .set({ originalPath: null, updatedAt: now })
      .where(eq(media.id, row.id))
    removed += 1
  }

  return removed
}

/**
 * Загрузки, которые не довели до конца за 3 дня: удаляем недогруженные куски и помечаем файл
 * ошибкой, чтобы он не висел «в загрузке» и не занимал диск.
 */
export async function cleanupAbandonedUploads(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ABANDONED_DAYS * 24 * 60 * 60 * 1000)

  const rows = await db
    .select()
    .from(media)
    .where(and(isNull(media.originalPath), ne(media.status, 'failed'), lte(media.createdAt, cutoff)))

  let removed = 0

  for (const row of rows) {
    try {
      await rm(safeJoin(mediaRoot(), mediaDir(row)), { recursive: true, force: true })
    } catch (error) {
      console.error('[media.cleanup] не удалось удалить брошенную загрузку', row.id, error)
      continue
    }

    await db
      .update(media)
      .set({ status: 'failed', error: 'Загрузка не была завершена', receivedChunks: [], updatedAt: now })
      .where(eq(media.id, row.id))
    removed += 1
  }

  return removed
}
