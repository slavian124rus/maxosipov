import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
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

  if (isVideo) {
    assertCan(actor, 'catalog.edit')
  }
  // Фото (прогресс, аватар) загружает сам владелец: `ownerId = actor.id`.
  // Загрузку за другого (тренер за клиента) добавим на этапе 3 вместе с замерами.

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

/** Кладёт кусок файла. Повторная загрузка того же куска идемпотентна. */
export async function putChunk(id: string, index: number, body: Uint8Array): Promise<void> {
  const row = await findMedia(id)

  if (!Number.isInteger(index) || index < 0 || index >= row.totalChunks) {
    throw new Error('Неверный номер части')
  }

  const dir = safeJoin(mediaRoot(), mediaDir(row))
  const chunksDir = path.join(dir, '.chunks')
  await mkdir(chunksDir, { recursive: true })
  await writeFile(path.join(chunksDir, `${index}.part`), body)

  if (!row.receivedChunks.includes(index)) {
    await db
      .update(media)
      .set({ receivedChunks: [...row.receivedChunks, index].sort((a, b) => a - b), updatedAt: new Date() })
      .where(eq(media.id, id))
  }
}

export type CompleteDeps = {
  enqueue?: (mediaId: string) => Promise<void>
}

/** Склеивает куски в `original.<ext>`, ставит `uploaded` и задачу обработки. */
export async function completeUpload(id: string, deps: CompleteDeps = {}): Promise<void> {
  const row = await findMedia(id)
  const enqueue = deps.enqueue ?? ((mediaId: string) => enqueueJob('media.process', { mediaId }))

  const missing: number[] = []
  for (let index = 0; index < row.totalChunks; index += 1) {
    if (!row.receivedChunks.includes(index)) missing.push(index)
  }
  if (missing.length > 0) throw new Error('Не все части загружены')

  const dir = safeJoin(mediaRoot(), mediaDir(row))
  const chunksDir = path.join(dir, '.chunks')
  const extension = extensionFor(row.kind, row.mime)
  const originalRel = `${mediaDir(row)}/original.${extension}`

  const buffers: Buffer[] = []
  for (let index = 0; index < row.totalChunks; index += 1) {
    buffers.push(await readFile(path.join(chunksDir, `${index}.part`)))
  }
  const file = Buffer.concat(buffers)

  await mkdir(dir, { recursive: true })
  await writeFile(safeJoin(mediaRoot(), originalRel), file)

  const size = (await stat(safeJoin(mediaRoot(), originalRel))).size
  if (size !== row.sizeBytes) {
    throw new Error('Размер файла не совпал с заявленным')
  }

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
