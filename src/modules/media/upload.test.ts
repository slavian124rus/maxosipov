import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import type { Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { media } from './schema'
import {
  CHUNK_SIZE,
  completeUpload,
  createUpload,
  getMediaStatus,
  putChunk,
  setProcessingOptions,
} from './upload'

const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000099',
  roleId: '00000000-0000-4000-8000-000000000001',
  gymId: '00000000-0000-4000-8000-000000000002',
  isOwner: false,
  permissions: [{ code: 'catalog.edit', scope: 'all' }],
}

const client: Actor = { ...actor, permissions: [] }

let root: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  root = await mkdtemp(path.join(tmpdir(), 'media-test-'))
  process.env.MEDIA_ROOT = root
})

async function upload3Chunks(): Promise<{ id: string; chunks: Buffer[] }> {
  const size = CHUNK_SIZE * 3
  const { id, totalChunks } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'video.mp4',
    sizeBytes: size,
    mime: 'video/mp4',
  })
  expect(totalChunks).toBe(3)

  const chunks = [
    Buffer.alloc(CHUNK_SIZE, 1),
    Buffer.alloc(CHUNK_SIZE, 2),
    Buffer.alloc(CHUNK_SIZE, 3),
  ]

  for (const [index, chunk] of chunks.entries()) {
    await putChunk(id, index, chunk)
  }

  return { id, chunks }
}

test('три куска по порядку: complete склеивает, размер совпадает', async () => {
  const { id } = await upload3Chunks()
  await completeUpload(id, { enqueue: async () => {} })

  const status = await getMediaStatus(id)
  expect(status.status).toBe('uploaded')
  expect(status.receivedChunks).toEqual([0, 1, 2])
  expect(status.totalChunks).toBe(3)

  const [row] = await db.select().from(media)
  expect(row?.originalPath).toMatch(/\/original\.mp4$/)
})

test('повторная загрузка куска 2 идемпотентна', async () => {
  const { id } = await upload3Chunks()
  await putChunk(id, 1, Buffer.alloc(CHUNK_SIZE, 9))

  const status = await getMediaStatus(id)
  expect(status.receivedChunks).toEqual([0, 1, 2])

  await completeUpload(id, { enqueue: async () => {} })
  expect((await getMediaStatus(id)).status).toBe('uploaded')
})

test('complete без куска 1 → «Не все части загружены»', async () => {
  const { id } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'v.mp4',
    sizeBytes: CHUNK_SIZE * 2,
    mime: 'video/mp4',
  })
  await putChunk(id, 1, Buffer.alloc(CHUNK_SIZE))

  await expect(completeUpload(id, { enqueue: async () => {} })).rejects.toThrow(
    'Не все части загружены',
  )
})

test('файл больше 300 МБ не принимается', async () => {
  await expect(
    createUpload(actor, {
      kind: 'exercise_video',
      fileName: 'big.mp4',
      sizeBytes: 301 * 1024 * 1024,
      mime: 'video/mp4',
    }),
  ).rejects.toThrow('Видео больше 300 МБ')
})

test('image/gif не принимается для видео', async () => {
  await expect(
    createUpload(actor, {
      kind: 'exercise_video',
      fileName: 'anim.gif',
      sizeBytes: 1000,
      mime: 'image/gif',
    }),
  ).rejects.toThrow(/Формат видео не поддерживается/)
})

test('клиент без catalog.edit не может загрузить видео', async () => {
  await expect(
    createUpload(client, {
      kind: 'exercise_video',
      fileName: 'v.mp4',
      sizeBytes: 1000,
      mime: 'video/mp4',
    }),
  ).rejects.toThrow()
})

test('complete ставит задачу media.process', async () => {
  const { id } = await upload3Chunks()
  const calls: string[] = []
  await completeUpload(id, { enqueue: async (mediaId) => void calls.push(mediaId) })
  expect(calls).toEqual([id])
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

test('setProcessingOptions: клиент не может, метки петли сохраняются, фото нельзя', async () => {
  const { id } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'v.mp4',
    sizeBytes: 100,
    mime: 'video/mp4',
  })

  await expect(setProcessingOptions(client, id, { cropX: 0.2 })).rejects.toThrow('Недостаточно прав')

  await db
    .update(media)
    .set({ processingOptions: { cropX: 0.5, loopStart: 1, loopEnd: 6 } })
    .where(eq(media.id, id))
  await setProcessingOptions(actor, id, { cropX: 0.2 })

  const [row] = await db.select().from(media).where(eq(media.id, id))
  expect(row?.processingOptions).toEqual({ cropX: 0.2, loopStart: 1, loopEnd: 6 })

  const [photo] = await db
    .insert(media)
    .values({
      kind: 'photo',
      ownerId: actor.id,
      sizeBytes: 10,
      mime: 'image/jpeg',
      totalChunks: 1,
    })
    .returning()
  await expect(setProcessingOptions(actor, photo!.id, { cropX: 0.3 })).rejects.toThrow(
    'только у видео',
  )
})

test('кусок неверного размера не принимается', async () => {
  const { id } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'v.mp4',
    sizeBytes: CHUNK_SIZE * 2 + 100,
    mime: 'video/mp4',
  })

  await expect(putChunk(id, 0, Buffer.alloc(CHUNK_SIZE + 1))).rejects.toThrow('Размер части')
  await expect(putChunk(id, 2, Buffer.alloc(99))).rejects.toThrow('Размер части')
  await putChunk(id, 2, Buffer.alloc(100))
})

test('параллельные куски все попадают в receivedChunks', async () => {
  const { id } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'v.mp4',
    sizeBytes: CHUNK_SIZE * 3,
    mime: 'video/mp4',
  })

  await Promise.all([0, 1, 2].map((index) => putChunk(id, index, Buffer.alloc(CHUNK_SIZE, index))))

  expect((await getMediaStatus(id)).receivedChunks).toEqual([0, 1, 2])
})

test('после complete куски не принимаются, а повторный complete не ставит задачу снова', async () => {
  const { id } = await upload3Chunks()
  let queued = 0
  const enqueue = async () => {
    queued += 1
  }

  await completeUpload(id, { enqueue })
  await completeUpload(id, { enqueue })

  expect(queued).toBe(1)
  await expect(putChunk(id, 0, Buffer.alloc(CHUNK_SIZE))).rejects.toThrow('Загрузка уже завершена')
})

test('фото пока не загружаются, даже владельцем файла', async () => {
  for (const kind of ['photo', 'progress_photo'] as const) {
    await expect(
      createUpload(actor, { kind, fileName: 'p.jpg', sizeBytes: 1000, mime: 'image/jpeg' }),
    ).rejects.toThrow('Загрузка фото пока недоступна')
  }
})

test('несовпадение размера сбрасывает загрузку, можно залить заново', async () => {
  const { id } = await createUpload(actor, {
    kind: 'exercise_video',
    fileName: 'v.mp4',
    sizeBytes: CHUNK_SIZE + 10,
    mime: 'video/mp4',
  })
  await putChunk(id, 0, Buffer.alloc(CHUNK_SIZE))
  await putChunk(id, 1, Buffer.alloc(10))

  // порча: заявленный размер в базе больше фактического
  await db.update(media).set({ sizeBytes: CHUNK_SIZE + 20 }).where(eq(media.id, id))
  await expect(completeUpload(id, { enqueue: async () => {} })).rejects.toThrow('загрузи видео заново')

  const status = await getMediaStatus(id)
  expect(status.receivedChunks).toEqual([])
  expect(status.status).toBe('uploaded')
})
