import { rm } from 'node:fs/promises'
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { getGym } from '@/modules/gym'
import {
  MUSCLE_OVERLAY_QUEUE,
  mediaDir,
  mediaRoot,
  safeJoin,
  signMediaPath,
  VIDEO_URL_TTL_SEC,
  type Media,
  type MediaRowStatus,
  type ProcessedPaths,
} from '@/modules/media'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { enqueueJob } from '@/shared/queue'
import { media } from '@/shared/db/schema'
import { exercises, machines, type Exercise, type LoadType, type Machine, type OverlayProfile } from './schema'
import { ensureZone } from './zones'
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
  machineId: string | null
  machineName: string | null
  /** Зона тренажёра — уровень иерархии в кабинете тренера. `null` без тренажёра или без зоны. */
  machineZone: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  status: string
  /** Постер видео. Для упражнения без видео — `null`, вместо него берут `thumbUrl`. */
  posterUrl: string | null
  /** Фото тренажёра: полное (≤ 1600) и миниатюра (≤ 400). `null`, если у тренажёра нет готового фото. */
  photoUrl: string | null
  thumbUrl: string | null
  /** Есть ли готовый ролик. Пока видео нет, в карточке и в списке показываем фото тренажёра. */
  hasVideo: boolean
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
  loadType: LoadType
  videoMp4Url: string | null
  videoWebmUrl: string | null
  musclesMp4Url: string | null
  hasMuscles: boolean
  /** Шаг веса тренажёра; для свободных весов — 2,5 кг. */
  weightStepKg: number
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

type PublishData = {
  videoMediaId: string | null
  machineId: string | null
  primaryMuscles: string[]
  steps: string[]
}

/**
 * Пути готового фото тренажёра. Фото показываем только если оно обработано и это
 * действительно фото тренажёра: строка `media` чужого вида (например `progress_photo`
 * клиента) не должна уехать в общий каталог по подписанной ссылке.
 */
function machinePhotoPaths(row: Media | null): ProcessedPaths | null {
  if (!row || row.kind !== 'machine_photo' || row.status !== 'ready') return null
  return row.processedPaths?.photo ? row.processedPaths : null
}

/** Есть ли у тренажёра готовое фото — им карточка заменяет видео, пока ролика нет. */
async function findMachinePhoto(machineId: string | null): Promise<Media | null> {
  if (!machineId) return null

  const [row] = await db
    .select({ photo: media })
    .from(machines)
    .innerJoin(media, eq(machines.photoMediaId, media.id))
    .where(eq(machines.id, machineId))
    .limit(1)

  const paths = machinePhotoPaths(row?.photo ?? null)
  return paths ? (row?.photo ?? null) : null
}

/**
 * Что мешает опубликовать упражнение; `null`, если всё в порядке.
 * Правило публикации: мышцы + шаги + (готовое видео **или** фото тренажёра).
 */
async function findPublishProblem(data: PublishData): Promise<string | null> {
  if (data.videoMediaId) {
    const [video] = await db.select().from(media).where(eq(media.id, data.videoMediaId)).limit(1)

    if (!video) return 'Добавь видео или фото тренажёра'
    if (video.status === 'processing') return 'Видео ещё обрабатывается'
    if (video.status !== 'ready') return 'Видео не обработалось — загрузи новое'
  } else if (!(await findMachinePhoto(data.machineId))) {
    return 'Добавь видео или фото тренажёра'
  }

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
  await assertMachinePhoto(data.photoMediaId)
  const gym = await getGym()
  // Свободно вписанная зона попадает в справочник, чтобы её было видно в настройках.
  if (data.zone) await ensureZone(data.zone)

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
  await assertMachinePhoto(data.photoMediaId)
  if (data.zone) await ensureZone(data.zone)

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

/** Сколько упражнений привязано к каждому тренажёру: всего и из них опубликованных. */
export type MachineExerciseCount = { total: number; published: number }

/**
 * Счётчики упражнений по тренажёрам. `total` включает черновики и архивные —
 * именно он решает, можно ли удалить тренажёр (`deleteMachine`). `published` —
 * для подписи «N в каталоге» в дереве.
 */
export async function countMachineExercises(): Promise<Record<string, MachineExerciseCount>> {
  const rows = await db
    .select({
      machineId: exercises.machineId,
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${exercises.status} = 'published' and ${exercises.archivedAt} is null)::int`,
    })
    .from(exercises)
    .where(isNotNull(exercises.machineId))
    .groupBy(exercises.machineId)

  const result: Record<string, MachineExerciseCount> = {}

  for (const row of rows) {
    if (!row.machineId) continue
    result[row.machineId] = { total: row.total, published: row.published }
  }

  return result
}

/**
 * Удаляет тренажёр, занесённый по ошибке, вместе с его фото.
 *
 * Только если к нему не привязано ни одного упражнения — у упражнений есть история
 * подходов, и её мы не теряем (CLAUDE.md, правило 6). Если упражнения есть, сначала
 * переносим их на другой тренажёр, иначе тренер получает понятную ошибку.
 */
export async function deleteMachine(actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'catalog.edit')

  const [machine] = await db.select().from(machines).where(eq(machines.id, id)).limit(1)
  if (!machine) throw new Error('Тренажёр не найден')

  // Считаем все упражнения, включая архивные: у них тоже есть история.
  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exercises)
    .where(eq(exercises.machineId, id))

  const count = used?.count ?? 0
  if (count > 0) {
    throw new Error(
      `К тренажёру привязаны упражнения: ${count}. Сначала перенеси их на другой тренажёр`,
    )
  }

  await db.delete(machines).where(eq(machines.id, id))

  if (!machine.photoMediaId) return

  const [photo] = await db.select().from(media).where(eq(media.id, machine.photoMediaId)).limit(1)
  if (!photo) return

  await db.delete(media).where(eq(media.id, photo.id))

  try {
    await rm(safeJoin(mediaRoot(), mediaDir(photo)), { recursive: true, force: true })
  } catch (error) {
    // Файлы могли уже уйти ночной уборкой — запись в базе важнее.
    console.error('[catalog] не удалось удалить файлы фото тренажёра', error)
  }
}

/**
 * К тренажёру можно привязать только фото тренажёра: личный снимок клиента
 * (`progress_photo`) не должен уехать в общий каталог по подписанной ссылке.
 */
async function assertMachinePhoto(photoMediaId: string | null): Promise<void> {
  if (!photoMediaId) return

  const [row] = await db
    .select({ kind: media.kind })
    .from(media)
    .where(eq(media.id, photoMediaId))
    .limit(1)

  if (!row || row.kind !== 'machine_photo') throw new Error('Фото тренажёра не найдено')
}

export async function listMachines(): Promise<Machine[]> {
  return db.select().from(machines).where(isNull(machines.archivedAt)).orderBy(asc(machines.name))
}

/** Тренажёр со ссылками на фото — для кабинета тренера. */
export type MachineListItem = Machine & {
  /** Полное фото (≤ 1600) и миниатюра (≤ 400); `null`, пока фото нет или оно не готово. */
  photoUrl: string | null
  thumbUrl: string | null
  photoStatus: MediaRowStatus | null
}

/**
 * Тренажёры с подписанными ссылками на фото (DESIGN.md §8.9): тренер видит, у какого
 * тренажёра фото есть, у какого нет, и может заменить его в форме.
 */
export async function listMachinesWithPhotos(): Promise<MachineListItem[]> {
  const rows = await db
    .select({ machine: machines, photo: media })
    .from(machines)
    .leftJoin(media, eq(machines.photoMediaId, media.id))
    .where(isNull(machines.archivedAt))
    .orderBy(asc(machines.name))

  return rows.map(({ machine, photo }) => {
    const paths = machinePhotoPaths(photo)

    return {
      ...machine,
      photoUrl: paths?.photo ? signMediaPath(paths.photo, VIDEO_URL_TTL_SEC) : null,
      thumbUrl: paths?.thumb ? signMediaPath(paths.thumb, VIDEO_URL_TTL_SEC) : null,
      // Статус нужен, чтобы показать «Фото обрабатывается…» сразу после загрузки.
      photoStatus: photo?.kind === 'machine_photo' ? photo.status : null,
    }
  })
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
      loadType: data.loadType ?? 'external',
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
      ...(data.loadType ? { loadType: data.loadType } : {}),
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

  // Одним запросом: упражнение + тренажёр + видео + фото тренажёра (раньше видео читалось
  // отдельным запросом на каждую строку). `machine_photo` — второй join той же таблицы media.
  const machinePhoto = alias(media, 'machine_photo')

  const rows = await db
    .select({
      exercise: exercises,
      machineName: machines.name,
      machineZone: machines.zone,
      video: media,
      photo: machinePhoto,
    })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .leftJoin(media, eq(exercises.videoMediaId, media.id))
    .leftJoin(machinePhoto, eq(machines.photoMediaId, machinePhoto.id))
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

  return rows.map(({ exercise, machineName, machineZone, video, photo }) => {
    const poster = video?.processedPaths?.poster
    const photoPaths = machinePhotoPaths(photo)

    return {
      id: exercise.id,
      slug: exercise.slug,
      name: exercise.name,
      machineId: exercise.machineId,
      machineName,
      machineZone,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      status: exercise.status,
      posterUrl: poster ? signMediaPath(poster, VIDEO_URL_TTL_SEC) : null,
      // Фото тренажёра — медиа каталога, живёт столько же, сколько постер видео.
      photoUrl: photoPaths?.photo ? signMediaPath(photoPaths.photo, VIDEO_URL_TTL_SEC) : null,
      thumbUrl: photoPaths?.thumb ? signMediaPath(photoPaths.thumb, VIDEO_URL_TTL_SEC) : null,
      hasVideo: Boolean(video?.processedPaths?.mp4 || video?.processedPaths?.webm),
      videoStatus: video?.status ?? null,
      hasMuscles: exercise.overlayProfile !== 'none' && Boolean(video?.processedPaths?.musclesMp4),
    }
  })
}

export type GetExerciseOptions = { includeDrafts?: boolean }

/** Карточка упражнения по id или slug с подписанными ссылками на видео и фото тренажёра. */
export async function getExercise(
  idOrSlug: string,
  options: GetExerciseOptions = {},
): Promise<ExerciseDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

  const [row] = await db
    .select({
      exercise: exercises,
      machineName: machines.name,
      machineZone: machines.zone,
      weightStepKg: machines.weightStepKg,
      machinePhotoMediaId: machines.photoMediaId,
    })
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

  const photoRow = row.machinePhotoMediaId
    ? await db.select().from(media).where(eq(media.id, row.machinePhotoMediaId)).limit(1)
    : []
  const photoPaths = machinePhotoPaths(photoRow[0] ?? null)

  const paths = video?.processedPaths
  const showMuscles = row.exercise.overlayProfile !== 'none'
  const sign = (value?: string): string | null =>
    value ? signMediaPath(value, VIDEO_URL_TTL_SEC) : null

  return {
    id: row.exercise.id,
    slug: row.exercise.slug,
    name: row.exercise.name,
    machineId: row.exercise.machineId,
    machineName: row.machineName,
    machineZone: row.machineZone,
    primaryMuscles: row.exercise.primaryMuscles,
    secondaryMuscles: row.exercise.secondaryMuscles,
    status: row.exercise.status,
    posterUrl: sign(paths?.poster),
    // Фото тренажёра заменяет видео в карточке, пока ролика нет.
    photoUrl: sign(photoPaths?.photo),
    thumbUrl: sign(photoPaths?.thumb),
    hasVideo: Boolean(paths?.mp4 || paths?.webm),
    steps: row.exercise.steps,
    mistakes: row.exercise.mistakes,
    tips: row.exercise.tips,
    defaultRepMin: row.exercise.defaultRepMin,
    defaultRepMax: row.exercise.defaultRepMax,
    overlayProfile: row.exercise.overlayProfile,
    loadType: row.exercise.loadType,
    videoMp4Url: sign(paths?.mp4),
    videoWebmUrl: sign(paths?.webm),
    musclesMp4Url: showMuscles ? sign(paths?.musclesMp4) : null,
    hasMuscles: showMuscles && Boolean(paths?.musclesMp4),
    videoStatus: video?.status ?? null,
    weightStepKg: row.weightStepKg ?? 2.5,
  }
}
