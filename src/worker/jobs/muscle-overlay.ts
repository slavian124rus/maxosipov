import { and, eq, ne } from 'drizzle-orm'
import { MUSCLE_OVERLAY_QUEUE, mediaDir, mediaRoot, runProcess, safeJoin } from '@/modules/media'
import { db } from '@/shared/db'
import { exercises, media } from '@/shared/db/schema'
import type { OverlayProfile } from '@/modules/catalog'

export { MUSCLE_OVERLAY_QUEUE }

export type MuscleOverlayData = {
  mediaId: string
  profile: Exclude<OverlayProfile, 'none'>
}

/** Профили подсветки упражнений, которые используют это видео. */
export async function profilesForMedia(
  mediaId: string,
): Promise<Exclude<OverlayProfile, 'none'>[]> {
  const rows = await db
    .select({ profile: exercises.overlayProfile })
    .from(exercises)
    .where(and(eq(exercises.videoMediaId, mediaId), ne(exercises.overlayProfile, 'none')))

  return rows.map((row) => row.profile as Exclude<OverlayProfile, 'none'>)
}

function python(): string {
  return process.env.PYTHON_PATH || 'python3'
}

function toolsDir(): string {
  return process.env.MEDIA_TOOLS_DIR || 'media-tools'
}

/**
 * Подсветка мышц: pose.py → overlay.py → `muscles.mp4`.
 * Любая ошибка не роняет обработку видео — упражнение публикуется без подсветки.
 */
export async function muscleOverlayJob(data: MuscleOverlayData): Promise<boolean> {
  const [row] = await db.select().from(media).where(eq(media.id, data.mediaId)).limit(1)
  if (!row?.processedPaths?.mp4) return false

  const source = safeJoin(mediaRoot(), row.processedPaths.mp4)
  const poseFile = safeJoin(mediaRoot(), `${mediaDir(row)}/pose.npz`)
  const outFile = safeJoin(mediaRoot(), `${mediaDir(row)}/muscles.mp4`)

  try {
    await runProcess(python(), [`${toolsDir()}/pose.py`, source, poseFile])
    await runProcess(python(), [
      `${toolsDir()}/overlay.py`,
      source,
      poseFile,
      data.profile,
      outFile,
    ])

    await db
      .update(media)
      .set({
        processedPaths: {
          ...row.processedPaths,
          musclesMp4: `${mediaDir(row)}/muscles.mp4`,
          musclesProfile: data.profile,
        },
        updatedAt: new Date(),
      })
      .where(eq(media.id, row.id))

    return true
  } catch (error) {
    console.error(`[media.muscles] ${row.id}: подсветка не сделана`, error)
    return false
  }
}
