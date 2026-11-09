import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { beforeAll, expect, test } from 'vitest'
import { processPhoto } from './photo'
import type { Media } from './schema'

let root: string

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'photo-test-'))
  process.env.MEDIA_ROOT = root
})

// Каталог в os.tmpdir() не удаляем: на Windows sharp иногда держит файл открытым,
// а уборка временного каталога ОС не входит в задачу теста.


/** Готовит исходник с EXIF-ориентацией, возвращает строку медиа. */
async function makeOriginal(): Promise<Media> {
  const relDir = `2026/11/${Math.random().toString(36).slice(2, 10)}`
  const dir = path.join(root, relDir)
  const { mkdir } = await import('node:fs/promises')
  await mkdir(dir, { recursive: true })

  // 3000×2000 с Orientation=6: после поворота кадр станет 2000×3000
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#336699' } })
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Copyright: 'Максим Осипов' } })
    .jpeg({ quality: 90 })
    .toFile(path.join(dir, 'original.jpg'))

  return {
    id: relDir.split('/')[2]!,
    createdAt: new Date('2026-11-07T00:00:00Z'),
    originalPath: `${relDir}/original.jpg`,
    kind: 'progress_photo',
    status: 'uploaded',
  } as unknown as Media
}

test('photo.webp ≤ 1600, thumb.webp ≤ 400, EXIF вырезан, оригинал удалён', async () => {
  const row = await makeOriginal()

  const originalMeta = await sharp(path.join(root, row.originalPath!)).metadata()
  expect(originalMeta.orientation).toBe(6)

  const paths = await processPhoto(row)

  const photoFile = path.join(root, paths.photo!)
  const thumbFile = path.join(root, paths.thumb!)

  const photoMeta = await sharp(photoFile).metadata()
  const thumbMeta = await sharp(thumbFile).metadata()

  // Orientation=6 поворачивает кадр: 3000×2000 → 2000×3000 → 1067×1600
  expect(Math.max(photoMeta.width ?? 0, photoMeta.height ?? 0)).toBeLessThanOrEqual(1600)
  expect(photoMeta.height).toBe(1600)
  expect(photoMeta.width).toBeLessThan(photoMeta.height ?? 0)

  expect(Math.max(thumbMeta.width ?? 0, thumbMeta.height ?? 0)).toBeLessThanOrEqual(400)
  expect(photoMeta.exif).toBeUndefined()
  expect(thumbMeta.exif).toBeUndefined()

  await expect(stat(path.join(root, row.originalPath!))).rejects.toThrow()
})

test('битый файл → ошибка с понятным текстом', async () => {
  const relDir = '2026/11/broken'
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.join(root, relDir), { recursive: true })
  await writeFile(path.join(root, relDir, 'original.jpg'), 'не картинка')

  const row = {
    id: 'broken',
    createdAt: new Date('2026-11-07T00:00:00Z'),
    originalPath: `${relDir}/original.jpg`,
    kind: 'progress_photo',
    status: 'uploaded',
  } as unknown as Media

  await expect(processPhoto(row)).rejects.toThrow(/Не получилось прочитать фото/)
})