import path from 'node:path'
import { env } from '@/shared/env'

/** Корень медиа. Читаем из `process.env` каждый раз — так тесты подменяют каталог. */
export function mediaRoot(): string {
  return process.env.MEDIA_ROOT || env.MEDIA_ROOT
}

/**
 * Каталог файла относительно `MEDIA_ROOT`: `<yyyy>/<mm>/<mediaId>`.
 * Даты — в UTC, чтобы путь не зависел от часового пояса процесса.
 */
export function mediaDir(media: { id: string; createdAt: Date }): string {
  const year = String(media.createdAt.getUTCFullYear())
  const month = String(media.createdAt.getUTCMonth() + 1).padStart(2, '0')
  return `${year}/${month}/${media.id}`
}

/** Склеивает корень и относительный путь, отказываясь выходить за корень. */
export function safeJoin(root: string, rel: string): string {
  if (rel.includes('\0')) throw new Error('Недопустимый путь')
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) throw new Error('Недопустимый путь')

  const normalized = path.posix.normalize(rel.replace(/\\/g, '/'))
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('Недопустимый путь')

  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, normalized)

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Недопустимый путь')
  }

  return resolved
}
