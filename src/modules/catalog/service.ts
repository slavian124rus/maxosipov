import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { getGym } from '@/modules/gym'
import { MUSCLE_OVERLAY_QUEUE, signMediaPath, VIDEO_URL_TTL_SEC } from '@/modules/media'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { enqueueJob } from '@/shared/queue'
import { media } from '@/shared/db/schema'
import { exercises, machines, type Exercise, type Machine, type OverlayProfile } from './schema'
import type { MuscleCode } from './muscles'
import { slugify } from './slug'
import {
  exerciseInputSchema,
  machineInputSchema,
  type ExerciseInput,
  type MachineInput,
} from './validation'

export type ExerciseListItem = {
  id: string
  slug: string
  name: string
  machineName: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  status: string
  posterUrl: string | null
  videoStatus: string | null
  hasMuscles: boolean
}

export type ExerciseDetail = ExerciseListItem & {
  steps: string[]
  mistakes: string[]
  tips: string | null
  defaultRepMin: number
  defaultRepMax: number
  overlayProfile: OverlayProfile
  videoMp4Url: string | null
  videoWebmUrl: string | null
  musclesMp4Url: string | null
  hasMuscles: boolean
}

async function uniqueSlug(gymId: string, name: string): Promise<string> {
  const base = slugify(name) || 'exercise'

  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    const [existing] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.gymId, gymId), eq(exercises.slug, candidate)))
      .limit(1)
    if (!existing) return candidate
  }

  return `${base}-${Date.now()}`
}

/**
 * Подсветка мышц делается по профилю упражнения. Видео обычно загружают раньше, чем создают
 * упражнение, поэтому после сохранения проверяем: видео готово, профиль задан, а готовой подсветки
 * с этим профилем ещё нет — тогда ставим задачу. Если видео ещё обрабатывается, задачу поставит
 * `media.process` по окончании. Ошибка очереди не мешает сохранить упражнение.
 */
async function scheduleOverlay(exercise: Exercise): Promise<void> {
  if (exercise.overlayProfile === 'none' || !exercise.videoMediaId) return

  try {
    const [video] = await db.select().from(media).where(eq(media.id, exercise.videoMediaId)).limit(1)
    if (!video || video.status !== 'ready') return

    const paths = video.processedPaths
    if (paths?.musclesMp4 && paths.musclesProfile === exercise.overlayProfile) return

    await enqueueJob(MUSCLE_OVERLAY_QUEUE, {
      mediaId: video.id,
      profile: exercise.overlayProfile,
    })
  } catch (error) {
    console.error('[catalog] не удалось поставить подсветку мышц в очередь', error)
  }
}

type PublishData = { videoMediaId: string | null; primaryMuscles: string[]; steps: string[] }

/** Что мешает опубликовать упражнение; `null`, если всё в порядке. */
async function findPublishProblem(data: PublishData): Promise<string | null> {
  if (!data.videoMediaId) return 'Добавь видео'

  const [video] = await db.select().from(media).where(eq(media.id, data.videoMediaId)).limit(1)

  if (!video) return 'Добавь видео'
  if (video.status === 'processing') return 'Видео ещё обрабатывается'
  if (video.status !== 'ready') return 'Видео не обработалось — загрузи новое'

  if (data.primaryMuscles.length === 0) return 'Отметь хотя бы одну основную мышцу'
  if (data.steps.length === 0) return 'Добавь хотя бы один шаг «Как делать»'

  return null
}

/** К упражнению можно привязать только видео упражнения, не фото и не чужие файлы. */
async function assertExerciseVideo(videoMediaId: string | null): Promise<void> {
  if (!videoMediaId) return
  const [row] = await db
    .select({ kind: media.kind })
    .from(media)
    .where(eq(media.id, videoMediaId))
    .limit(1)
  if (!row || row.kind !== 'exercise_video') throw new Error('Видео не найдено')
}

export async function createMachine(actor: Actor, input: MachineInput): Promise<Machine> {
  assertCan(actor, 'catalog.edit')
  const data = machineInputSchema.parse(input)
  const gym = await getGym()

  const [row] = await db
    .insert(machines)
    .values({
      gymId: gym.id,
      name: data.name,
      zone: data.zone,
      weightStepKg: data.weightStepKg,
      photoMediaId: data.photoMediaId,
    })
    .returning()

  if (!row) throw new Error('Тренажёр не создан')
  return row
}

export async function updateMachine(
  actor: Actor,
  id: string,
  input: MachineInput,
): Promise<Machine> {
  assertCan(actor, 'catalog.edit')
  const data = machineInputSchema.parse(input)

  const [row] = await db
    .update(machines)
    .set({
      name: data.name,
      zone: data.zone,
      weightStepKg: data.weightStepKg,
      photoMediaId: data.photoMediaId,
      updatedAt: new Date(),
    })
    .where(eq(machines.id, id))
    .returning()

  if (!row) throw new Error('Тренажёр не найден')
  return row
}

export async function listMachines(): Promise<Machine[]> {
  return db.select().from(machines).where(isNull(machines.archivedAt)).orderBy(asc(machines.name))
}

export async function createExercise(actor: Actor, input: ExerciseInput): Promise<Exercise> {
  assertCan(actor, 'catalog.edit')
  const data = exerciseInputSchema.parse(input)
  await assertExerciseVideo(data.videoMediaId)
  const gym = await getGym()
  const slug = await uniqueSlug(gym.id, data.name)

  const [row] = await db
    .insert(exercises)
    .values({
      gymId: gym.id,
      machineId: data.machineId,
      name: data.name,
      slug,
      primaryMuscles: data.primaryMuscles,
      secondaryMuscles: data.secondaryMuscles,
      videoMediaId: data.videoMediaId,
      overlayProfile: data.overlayProfile,
      steps: data.steps,
      mistakes: data.mistakes,
      tips: data.tips,
      defaultRepMin: data.defaultRepMin,
      defaultRepMax: data.defaultRepMax,
    })
    .returning()

  if (!row) throw new Error('Упражнение не создано')
  await scheduleOverlay(row)
  return row
}

export async function updateExercise(
  actor: Actor,
  id: string,
  input: ExerciseInput,
): Promise<Exercise> {
  assertCan(actor, 'catalog.edit')
  const data = exerciseInputSchema.parse(input)
  await assertExerciseVideo(data.videoMediaId)

  const [existing] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
  if (!existing) throw new Error('Упражнение не найдено')

  // Правка не должна оставлять в каталоге пустую карточку: если опубликованное упражнение
  // перестало удовлетворять правилам публикации, оно возвращается в черновики.
  const problem = existing.status === 'published' ? await findPublishProblem(data) : null

  const [row] = await db
    .update(exercises)
    .set({
      machineId: data.machineId,
      name: data.name,
      primaryMuscles: data.primaryMuscles,
      secondaryMuscles: data.secondaryMuscles,
      videoMediaId: data.videoMediaId,
      overlayProfile: data.overlayProfile,
      steps: data.steps,
      mistakes: data.mistakes,
      tips: data.tips,
      defaultRepMin: data.defaultRepMin,
      defaultRepMax: data.defaultRepMax,
      status: problem ? 'draft' : existing.status,
      updatedAt: new Date(),
    })
    .where(eq(exercises.id, id))
    .returning()

  if (!row) throw new Error('Упражнение не найдено')
  await scheduleOverlay(row)
  return row
}

/** Публикация: видео готово, есть основная мышца и хотя бы один шаг. */
export async function publishExercise(actor: Actor, id: string): Promise<Exercise> {
  assertCan(actor, 'catalog.publish')

  const [exercise] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
  if (!exercise) throw new Error('Упражнение не найдено')

  const problem = await findPublishProblem(exercise)
  if (problem) throw new Error(problem)

  const [row] = await db
    .update(exercises)
    .set({ status: 'published', updatedAt: new Date() })
    .where(eq(exercises.id, id))
    .returning()

  if (!row) throw new Error('Упражнение не найдено')
  return row
}

export async function unpublishExercise(actor: Actor, id: string): Promise<Exercise> {
  assertCan(actor, 'catalog.publish')

  const [row] = await db
    .update(exercises)
    .set({ status: 'draft', updatedAt: new Date() })
    .where(eq(exercises.id, id))
    .returning()

  if (!row) throw new Error('Упражнение не найдено')
  return row
}

/** Архив: из каталога пропадает, в истории остаётся (CLAUDE.md, правило 6). */
export async function archiveExercise(actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'catalog.edit')
  await db
    .update(exercises)
    .set({ archivedAt: new Date(), status: 'draft', updatedAt: new Date() })
    .where(eq(exercises.id, id))
}

export type ExerciseFilter = {
  muscle?: string
  machineId?: string
  query?: string
  status?: 'published' | 'draft' | 'all'
}

/** Список каталога. По умолчанию — только опубликованные и неархивные. */
export async function listExercises(filter: ExerciseFilter = {}): Promise<ExerciseListItem[]> {
  const status = filter.status ?? 'published'
  const conditions = [isNull(exercises.archivedAt)]

  if (status === 'published') conditions.push(eq(exercises.status, 'published'))
  if (status === 'draft') conditions.push(eq(exercises.status, 'draft'))
  if (filter.machineId) conditions.push(eq(exercises.machineId, filter.machineId))

  if (filter.muscle) {
    conditions.push(
      sql`(${filter.muscle} = ANY(${exercises.primaryMuscles}) OR ${filter.muscle} = ANY(${exercises.secondaryMuscles}))`,
    )
  }

  const query = filter.query?.trim()
  if (query) {
    const normalized = `%${query.toLowerCase().replace(/ё/g, 'е')}%`
    conditions.push(sql`replace(lower(${exercises.name}), 'ё', 'е') like ${normalized}`)
  }

  const rows = await db
    .select({ exercise: exercises, machineName: machines.name })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .where(and(...conditions))
    .orderBy(asc(exercises.name))

  const muscle = filter.muscle
  if (muscle) {
    rows.sort((a, b) => {
      const aPrimary = a.exercise.primaryMuscles.includes(muscle as MuscleCode) ? 0 : 1
      const bPrimary = b.exercise.primaryMuscles.includes(muscle as MuscleCode) ? 0 : 1
      return aPrimary - bPrimary
    })
  }

  return Promise.all(
    rows.map(async ({ exercise, machineName }) => {
      const [video] = exercise.videoMediaId
        ? await db.select().from(media).where(eq(media.id, exercise.videoMediaId)).limit(1)
        : []

      const poster = video?.processedPaths?.poster

      return {
        id: exercise.id,
        slug: exercise.slug,
        name: exercise.name,
        machineName,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        status: exercise.status,
        posterUrl: poster ? signMediaPath(poster, VIDEO_URL_TTL_SEC) : null,
        videoStatus: video?.status ?? null,
        hasMuscles: exercise.overlayProfile !== 'none' && Boolean(video?.processedPaths?.musclesMp4),
      }
    }),
  )
}

export type GetExerciseOptions = { includeDrafts?: boolean }

/** Карточка упражнения по id или slug с подписанными ссылками на видео. */
export async function getExercise(
  idOrSlug: string,
  options: GetExerciseOptions = {},
): Promise<ExerciseDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

  const [row] = await db
    .select({ exercise: exercises, machineName: machines.name })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .where(isUuid ? eq(exercises.id, idOrSlug) : eq(exercises.slug, idOrSlug))
    .limit(1)

  if (!row) return null
  if (row.exercise.archivedAt) return null
  if (!options.includeDrafts && row.exercise.status !== 'published') return null

  const [video] = row.exercise.videoMediaId
    ? await db.select().from(media).where(eq(media.id, row.exercise.videoMediaId)).limit(1)
    : []

  const paths = video?.processedPaths
  const showMuscles = row.exercise.overlayProfile !== 'none'
  const sign = (value?: string): string | null =>
    value ? signMediaPath(value, VIDEO_URL_TTL_SEC) : null

  return {
    id: row.exercise.id,
    slug: row.exercise.slug,
    name: row.exercise.name,
    machineName: row.machineName,
    primaryMuscles: row.exercise.primaryMuscles,
    secondaryMuscles: row.exercise.secondaryMuscles,
    status: row.exercise.status,
    posterUrl: sign(paths?.poster),
    steps: row.exercise.steps,
    mistakes: row.exercise.mistakes,
    tips: row.exercise.tips,
    defaultRepMin: row.exercise.defaultRepMin,
    defaultRepMax: row.exercise.defaultRepMax,
    overlayProfile: row.exercise.overlayProfile,
    videoMp4Url: sign(paths?.mp4),
    videoWebmUrl: sign(paths?.webm),
    musclesMp4Url: showMuscles ? sign(paths?.musclesMp4) : null,
    hasMuscles: showMuscles && Boolean(paths?.musclesMp4),
    videoStatus: video?.status ?? null,
  }
}
