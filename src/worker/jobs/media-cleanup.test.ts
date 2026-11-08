import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { mediaDir } from '@/modules/media'
import { db } from '@/shared/db'
import { media } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { cleanupAbandonedUploads, cleanupOriginals } from './media-cleanup'

const NOW = new Date('2026-11-10T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000
let root: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  root = await mkdtemp(path.join(tmpdir(), 'media-cleanup-'))
  process.env.MEDIA_ROOT = root
})

async function insert(values: Partial<typeof media.$inferInsert>) {
  const [row] = await db
    .insert(media)
    .values({
      kind: 'exercise_video',
      ownerId: '00000000-0000-4000-8000-000000000010',
      sizeBytes: 10,
      mime: 'video/mp4',
      totalChunks: 1,
      ...values,
    })
    .returning()
  const dir = path.join(root, mediaDir(row!))
  await mkdir(path.join(dir, '.chunks'), { recursive: true })
  await writeFile(path.join(dir, '.chunks', '0.part'), 'x')
  return { row: row!, dir }
}

test('брошенная загрузка старше 3 дней: файлы удалены, статус failed', async () => {
  const old = await insert({ createdAt: new Date(NOW.getTime() - 4 * DAY) })
  const fresh = await insert({ createdAt: new Date(NOW.getTime() - 1 * DAY) })

  expect(await cleanupAbandonedUploads(NOW)).toBe(1)

  await expect(stat(old.dir)).rejects.toThrow()
  await expect(stat(fresh.dir)).resolves.toBeTruthy()

  const [row] = await db.select().from(media).where(eq(media.id, old.row.id))
  expect(row?.status).toBe('failed')
  expect(row?.error).toBe('Загрузка не была завершена')

  // повторный запуск ничего не трогает
  expect(await cleanupAbandonedUploads(NOW)).toBe(0)
})

test('загрузка с исходником не считается брошенной', async () => {
  const done = await insert({
    createdAt: new Date(NOW.getTime() - 10 * DAY),
    originalPath: '2026/10/x/original.mp4',
    status: 'processing',
  })

  expect(await cleanupAbandonedUploads(NOW)).toBe(0)
  await expect(stat(done.dir)).resolves.toBeTruthy()
})

test('исходники готовых видео старше 30 дней удаляются, свежие остаются', async () => {
  const old = await insert({
    status: 'ready',
    originalPath: '2026/09/old/original.mp4',
    updatedAt: new Date(NOW.getTime() - 31 * DAY),
  })
  const fresh = await insert({
    status: 'ready',
    originalPath: '2026/11/fresh/original.mp4',
    updatedAt: new Date(NOW.getTime() - 5 * DAY),
  })

  expect(await cleanupOriginals(NOW)).toBe(1)

  const [oldRow] = await db.select().from(media).where(eq(media.id, old.row.id))
  const [freshRow] = await db.select().from(media).where(eq(media.id, fresh.row.id))
  expect(oldRow?.originalPath).toBeNull()
  expect(freshRow?.originalPath).toBe('2026/11/fresh/original.mp4')
})

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})
