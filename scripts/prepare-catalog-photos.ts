/**
 * Готовит фото тренажёров для каталога: `ФОТО ЗАЛА/` → `content/catalog/photos/`.
 *
 * Рецепт тот же, что у `src/modules/media/photo.ts`: `rotate()` (ориентация из EXIF),
 * ≤ 1600 px по длинной стороне, WebP q80, метаданные/EXIF не переносятся, плюс
 * миниатюра ≤ 400 px (q72) для списка каталога.
 *
 * Дополнительно применяется кроп из `content/catalog/kolizey.ts` — им из кадра убраны
 * люди и отражения в зеркалах (рамки посчитаны `media-tools/people.py`).
 *
 * Исходники в «ФОТО ЗАЛА/» только читаются и никогда не изменяются (CLAUDE.md §6).
 * Запуск: `pnpm catalog:photos`
 */
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { KOLIZEY_MACHINES } from '../content/catalog/kolizey'

/** 24 МП — как в `src/modules/media/photo.ts`. */
const MAX_INPUT_PIXELS = 24_000_000

const PHOTO_SIDE = 1600
const THUMB_SIDE = 400
const PHOTO_QUALITY = 80
const THUMB_QUALITY = 72

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = path.join(ROOT, 'ФОТО ЗАЛА')
const OUT_DIR = path.join(ROOT, 'content', 'catalog', 'photos')

/**
 * Поворачивает кадр по EXIF и возвращает буфер в «правильной» ориентации вместе
 * с реальными размерами — кроп задан в этих координатах.
 */
async function oriented(source: string): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .toBuffer({ resolveWithObject: true })

  return { data, width: info.width, height: info.height }
}

function assertCropFits(
  crop: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
  file: string,
): void {
  if (crop.left < 0 || crop.top < 0) throw new Error(`${file}: кроп начинается за пределами кадра`)
  if (crop.left + crop.width > width || crop.top + crop.height > height) {
    throw new Error(
      `${file}: кроп ${crop.width}×${crop.height} в (${crop.left},${crop.top}) не влезает в ${width}×${height}`,
    )
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })

  let done = 0
  let skipped = 0

  for (const machine of KOLIZEY_MACHINES) {
    if (!machine.photo) {
      console.log(`– ${machine.slug}: фото нет, пропускаем`)
      skipped += 1
      continue
    }

    const source = path.join(SOURCE_DIR, machine.photo.file)
    try {
      await stat(source)
    } catch {
      throw new Error(`${machine.slug}: исходник не найден — ${machine.photo.file}`)
    }

    const { data, width, height } = await oriented(source)

    let frame = sharp(data, { limitInputPixels: MAX_INPUT_PIXELS })
    if (machine.photo.crop) {
      assertCropFits(machine.photo.crop, width, height, machine.photo.file)
      frame = frame.extract(machine.photo.crop)
    }

    const photoFile = path.join(OUT_DIR, `${machine.slug}.webp`)
    const thumbFile = path.join(OUT_DIR, `${machine.slug}.thumb.webp`)

    // Два прогона с одного буфера: как в `processPhoto`, только исходник не удаляем.
    await frame
      .clone()
      .resize({ width: PHOTO_SIDE, height: PHOTO_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: PHOTO_QUALITY })
      .toFile(photoFile)

    await frame
      .clone()
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(thumbFile)

    const photoSize = (await stat(photoFile)).size
    const thumbSize = (await stat(thumbFile)).size
    const crop = machine.photo.crop
    console.log(
      `✓ ${machine.slug}: ${machine.photo.file}${crop ? ` → кроп ${crop.width}×${crop.height}` : ''}` +
        ` → ${(photoSize / 1024).toFixed(0)} КБ + миниатюра ${(thumbSize / 1024).toFixed(0)} КБ`,
    )
    done += 1
  }

  console.log(`\nГотово: ${done} фото, без фото: ${skipped}. Каталог: content/catalog/photos/`)
}

// Запускаем только при прямом вызове (`pnpm catalog:photos`), как в `scripts/seed.ts`.
const isEntrypoint =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
