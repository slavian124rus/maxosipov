import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { enqueueJob } from '@/shared/queue'
import { mediaDir, mediaRoot, safeJoin } from './paths'
import { media, type MediaKind, type ProcessingOptions } from './schema'

export const CHUNK_SIZE = 5 * 1024 * 1024
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024

const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/webm': 'webm',
}

const PHOTO_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export type CreateUploadInput = {
  kind: MediaKind
  fileName: string
  sizeBytes: number
  mime: string
}

export type CreatedUpload = { id: string; chunkSize: number; totalChunks: number }

function extensionFor(kind: MediaKind, mime: string): string {
  const table = kind === 'exercise_video' ? VIDEO_MIME : PHOTO_MIME
  const extension = table[mime]
  if (!extension) {
    throw new Error(
      kind === 'exercise_video'
        ? 'Формат видео не поддерживается: нужен mp4, mov, m4v или webm'
        : 'Формат фото не поддерживается: нужен jpg, png, webp или heic',
    )
  }
  return extension
}

/** Создаёт запись загрузки и проверяет права, размер и формат. */
export async function createUpload(
  actor: Actor,
  input: CreateUploadInput,
): Promise<CreatedUpload> {
  const isVideo = input.kind === 'exercise_video'

  // Фото (прогресс, аватар) появятся на этапе 3 вместе с квотой на клиента: пока любой
  // зарегистрированный пользователь мог бы забить диск, поэтому принимаем только видео упражнений.
  if (!isVideo) throw new Error('Загрузка фото пока недоступна')

  assertCan(actor, 'catalog.edit')

  const max = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (input.sizeBytes > max) {
    throw new Error(isVideo ? 'Видео больше 300 МБ' : 'Фото больше 20 МБ')
  }
  if (input.sizeBytes <= 0) {
    throw new Error('Файл пустой')
  }

  extensionFor(input.kind, input.mime)

  const totalChunks = Math.max(1, Math.ceil(input.sizeBytes / CHUNK_SIZE))
  const [row] = await db
    .insert(media)
    .values({
      kind: input.kind,
      ownerId: actor.id,
      sizeBytes: input.sizeBytes,
      mime: input.mime,
      totalChunks,
      processingOptions: isVideo ? { cropX: 0.5 } : null,
    })
    .returning({ id: media.id })

  if (!row) throw new Error('Не удалось создать загрузку')

  return { id: row.id, chunkSize: CHUNK_SIZE, totalChunks }
}

async function findMedia(id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  if (!row) throw new Error('Файл не найден')
  return row
}

/** Ожидаемый размер куска: все по `CHUNK_SIZE`, последний — остаток. */
export function expectedChunkSize(row: { sizeBytes: number; totalChunks: number }, index: number): number {
  return index === row.totalChunks - 1 ? row.sizeBytes - CHUNK_SIZE * (row.totalChunks - 1) : CHUNK_SIZE
}

/** Кладёт кусок файла. Повторная загрузка того же куска идемпотентна. */
export async function putChunk(id: string, index: number, body: Uint8Array): Promise<void> {
  const row = await findMedia(id)

  if (row.originalPath) throw new Error('Загрузка уже завершена')

  if (!Number.isInteger(index) || index < 0 || index >= row.totalChunks) {
    throw new Error('Неверный номер части')
  }
  if (body.byteLength !== expectedChunkSize(row, index)) {
    throw new Error('Размер части не совпал с ожидаемым')
  }

  const dir = safeJoin(mediaRoot(), mediaDir(row))
  const chunksDir = path.join(dir, '.chunks')
  await mkdir(chunksDir, { recursive: true })
  await writeFile(path.join(chunksDir, `${index}.part`), body)

  // Одним запросом: куски могут приходить параллельно, и «прочитать, дополнить, записать» терял бы номера.
  await db
    .update(media)
    .set({
      receivedChunks: sql`(SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(array_append(${media.receivedChunks}, ${index}::integer)) AS c)`,
      updatedAt: new Date(),
    })
    .where(eq(media.id, id))
}

export type CompleteDeps = {
  enqueue?: (mediaId: string) => Promise<void>
}

/**
 * Склеивает куски в `original.<ext>`, ставит `uploaded` и задачу обработки.
 * Куски дописываются по одному (в памяти не больше одного куска), повторный вызов ничего не делает.
 */
export async function completeUpload(id: string, deps: CompleteDeps = {}): Promise<void> {
  const row = await findMedia(id)
  const enqueue = deps.enqueue ?? ((mediaId: string) => enqueueJob('media.process', { mediaId }))

  if (row.originalPath) return

  const missing: number[] = []
  for (let index = 0; index < row.totalChunks; index += 1) {
    if (!row.receivedChunks.includes(index)) missing.push(index)
  }
  if (missing.length > 0) throw new Error('Не все части загружены')

  const dir = safeJoin(mediaRoot(), mediaDir(row))
  const chunksDir = path.join(dir, '.chunks')
  const extension = extensionFor(row.kind, row.mime)
  const originalRel = `${mediaDir(row)}/original.${extension}`
  const originalAbs = safeJoin(mediaRoot(), originalRel)
  const partial = `${originalAbs}.part`

  await mkdir(dir, { recursive: true })

  const handle = await open(partial, 'w')
  try {
    for (let index = 0; index < row.totalChunks; index += 1) {
      await handle.appendFile(await readFile(path.join(chunksDir, `${index}.part`)))
    }
  } finally {
    await handle.close()
  }

  const size = (await stat(partial)).size
  if (size !== row.sizeBytes) {
    // Начинаем загрузку заново, иначе клиент застрянет на «все куски есть, но размер не тот».
    await rm(partial, { force: true })
    await rm(chunksDir, { recursive: true, force: true })
    await db.update(media).set({ receivedChunks: [], updatedAt: new Date() }).where(eq(media.id, id))
    throw new Error('Размер файла не совпал с заявленным — загрузи видео заново')
  }

  await rename(partial, originalAbs)
  await rm(chunksDir, { recursive: true, force: true })

  await db
    .update(media)
    .set({ status: 'uploaded', originalPath: originalRel, updatedAt: new Date() })
    .where(eq(media.id, id))

  await enqueue(id)
}

export type MediaStatus = {
  id: string
  status: string
  receivedChunks: number[]
  totalChunks: number
  error: string | null
}
/** Статус загрузки: по нему клиент продолжает прерванную загрузку. */
export async function getMediaStatus(id: string): Promise<MediaStatus> {
  const row = await findMedia(id)
  return {
    id: row.id,
    status: row.status,
    receivedChunks: row.receivedChunks,
    totalChunks: row.totalChunks,
    error: row.error,
  }
}

/**
 * Настройки обработки видео упражнения: `cropX` и ручные метки петли.
 * Меняет только тот, кто правит каталог, и только у видео упражнений; метки петли сохраняются.
 */
export async function setProcessingOptions(
  actor: Actor,
  id: string,
  options: ProcessingOptions,
): Promise<void> {
  assertCan(actor, 'catalog.edit')

  const row = await findMedia(id)
  if (row.kind !== 'exercise_video') throw new Error('Настройки есть только у видео упражнений')

  await db
    .update(media)
    .set({ processingOptions: { ...row.processingOptions, ...options }, updatedAt: new Date() })
    .where(eq(media.id, id))
}
