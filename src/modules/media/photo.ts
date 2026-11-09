import { rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { mediaDir, mediaRoot, safeJoin } from './paths'
import type { Media, ProcessedPaths } from './schema'

/** 24 МП — выше этого снимок с телефона уже подозрительно большой. */
const MAX_INPUT_PIXELS = 24_000_000

const PHOTO_SIDE = 1600
const THUMB_SIDE = 400

/**
 * Готовит фото прогресса: `photo.webp` (≤ 1600 по длинной стороне) и `thumb.webp` (≤ 400).
 * EXIF/GPS не переносятся (не вызываем `withMetadata`), ориентация применяется через `rotate()`.
 * Оригинал удаляется после успешной записи обоих файлов.
 */
export async function processPhoto(row: Media): Promise<ProcessedPaths> {
  if (!row.originalPath) throw new Error('Исходник не найден')

  const relDir = mediaDir(row)
  const dir = safeJoin(mediaRoot(), relDir)
  const original = safeJoin(mediaRoot(), row.originalPath)

  try {
    await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: PHOTO_SIDE, height: PHOTO_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(dir, 'photo.webp'))

    await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(path.join(dir, 'thumb.webp'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (/pixel limit|Input image exceeds pixel limit/i.test(message)) {
      throw new Error('Фото слишком большое. Сделай снимок в обычном разрешении')
    }

    throw new Error(`Не получилось прочитать фото: ${message}`)
  }

  await rm(original, { force: true })

  return {
    photo: `${relDir}/photo.webp`,
    thumb: `${relDir}/thumb.webp`,
  }
}
