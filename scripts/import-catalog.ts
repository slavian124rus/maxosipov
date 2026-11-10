/**
 * Импорт каталога зала «Колизей» из `content/catalog/kolizey.ts`.
 *
 * Что делает:
 * - тренажёры: upsert по имени внутри зала, фото — строка `media` вида `machine_photo`
 *   и файлы в `MEDIA_ROOT` по общим правилам модуля `media` (`mediaDir`, `safeJoin`);
 * - упражнения: upsert по `slug` внутри зала, статус по умолчанию `draft`;
 * - `--publish` публикует только записи без `needsReview` (и только если правило
 *   публикации выполняется: мышцы, шаги и готовое фото тренажёра).
 *
 * Чего не делает: ничего не удаляет и не трогает упражнения, у которых уже есть видео.
 * Повторный запуск не плодит дубли: фото берётся из существующей строки `media`,
 * если она уже готова (чтобы обновить фото, обнули `machines.photo_media_id`).
 *
 * Запуск: `pnpm catalog:import` · `pnpm catalog:import --publish`
 */
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  KOLIZEY_EXERCISES,
  KOLIZEY_MACHINES,
  type CatalogExercise,
  type CatalogMachine,
} from '../content/catalog/kolizey'
import { exerciseInputSchema, exercises, machines } from '@/modules/catalog'
import { getGym, getHeadTrainerId } from '@/modules/gym'
import { media, mediaDir, mediaRoot, safeJoin } from '@/modules/media'
import { client, db } from '@/shared/db'
import { users } from '@/shared/db/schema'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_PHOTOS_DIR = path.join(ROOT, 'content', 'catalog', 'photos')

export type ImportOptions = {
  /** Публиковать записи без `needsReview`. По умолчанию всё остаётся в черновиках. */
  publish?: boolean
  /** Откуда брать подготовленные `pnpm catalog:photos` webp-файлы. */
  photosDir?: string
  log?: (line: string) => void
}

export type ImportSummary = {
  machinesCreated: number
  machinesUpdated: number
  photosImported: number
  photosReused: number
  exercisesCreated: number
  exercisesUpdated: number
  exercisesSkippedWithVideo: number
  exercisesPublished: number
  /** Записи, которые `--publish` не тронул из-за `needsReview`. */
  needsReview: string[]
  /** Записи, которые нельзя опубликовать: нет готового фото тренажёра и нет видео. */
  notPublishable: string[]
}

const emptySummary = (): ImportSummary => ({
  machinesCreated: 0,
  machinesUpdated: 0,
  photosImported: 0,
  photosReused: 0,
  exercisesCreated: 0,
  exercisesUpdated: 0,
  exercisesSkippedWithVideo: 0,
  exercisesPublished: 0,
  needsReview: [],
  notPublishable: [],
})

/** Проверка целостности контента: дубли и упражнения без тренажёра ловим до записи в базу. */
export function validateContent(
  contentMachines: CatalogMachine[] = KOLIZEY_MACHINES,
  contentExercises: CatalogExercise[] = KOLIZEY_EXERCISES,
): string[] {
  const problems: string[] = []

  const machineSlugs = new Set<string>()
  const machineNames = new Set<string>()
  for (const machine of contentMachines) {
    if (machineSlugs.has(machine.slug)) problems.push(`дублируется slug тренажёра: ${machine.slug}`)
    machineSlugs.add(machine.slug)
    // Тренажёры ищем по имени, поэтому два одинаковых имени схлопнутся в одну строку.
    if (machineNames.has(machine.name)) problems.push(`дублируется имя тренажёра: ${machine.name}`)
    machineNames.add(machine.name)
  }

  const exerciseSlugs = new Set<string>()
  for (const exercise of contentExercises) {
    if (exerciseSlugs.has(exercise.slug)) {
      problems.push(`дублируется slug упражнения: ${exercise.slug}`)
    }
    exerciseSlugs.add(exercise.slug)

    if (!machineSlugs.has(exercise.machine)) {
      problems.push(`«${exercise.name}»: нет тренажёра с slug ${exercise.machine}`)
    }
    if (exercise.steps.length < 3 || exercise.steps.length > 5) {
      problems.push(`«${exercise.name}»: шагов должно быть 3–5, сейчас ${exercise.steps.length}`)
    }
    if (exercise.mistakes.length < 2 || exercise.mistakes.length > 3) {
      problems.push(
        `«${exercise.name}»: ошибок должно быть 2–3, сейчас ${exercise.mistakes.length}`,
      )
    }
  }

  return problems
}

/**
 * Кому принадлежит файл в `media`: главный тренер зала (Максим), а если его нет —
 * первый пользователь. Нужен только для `owner_id`, доступ к фото тренажёра
 * раздаётся по подписанной ссылке.
 */
async function resolveOwnerId(): Promise<string> {
  const headTrainerId = await getHeadTrainerId()
  if (headTrainerId) return headTrainerId

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.createdAt))
    .limit(1)

  if (!user) throw new Error('В базе нет пользователей — сначала выполни pnpm db:seed')
  return user.id
}

/** Готовое фото тренажёра уже есть — возвращаем id строки `media`, иначе `null`. */
async function findReadyPhoto(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null

  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1)
  if (!row || row.kind !== 'machine_photo' || row.status !== 'ready') return null
  return row.processedPaths?.photo ? row.id : null
}

/**
 * Кладёт подготовленные `<slug>.webp` и `<slug>.thumb.webp` в `MEDIA_ROOT` по правилам
 * модуля `media` (`<yyyy>/<mm>/<mediaId>/photo.webp` + `thumb.webp`) и создаёт строку
 * `machine_photo` в статусе `ready`. Обработка уже выполнена `pnpm catalog:photos`,
 * поэтому очередь не ставим.
 */
async function importMachinePhoto(slug: string, ownerId: string, photosDir: string): Promise<string> {
  const photoSource = path.join(photosDir, `${slug}.webp`)
  const thumbSource = path.join(photosDir, `${slug}.thumb.webp`)

  for (const file of [photoSource, thumbSource]) {
    try {
      await stat(file)
    } catch {
      throw new Error(
        `Нет подготовленного фото ${path.relative(ROOT, file)} — выполни pnpm catalog:photos`,
      )
    }
  }

  const id = randomUUID()
  const createdAt = new Date()
  const relDir = mediaDir({ id, createdAt })
  const dir = safeJoin(mediaRoot(), relDir)
  await mkdir(dir, { recursive: true })

  const photoRel = `${relDir}/photo.webp`
  const thumbRel = `${relDir}/thumb.webp`
  await copyFile(photoSource, safeJoin(mediaRoot(), photoRel))
  await copyFile(thumbSource, safeJoin(mediaRoot(), thumbRel))

  const sizeBytes = (await stat(photoSource)).size + (await stat(thumbSource)).size

  const [row] = await db
    .insert(media)
    .values({
      id,
      kind: 'machine_photo',
      ownerId,
      status: 'ready',
      // Исходник из «ФОТО ЗАЛА/» не копируем: он только для чтения и остаётся на месте.
      originalPath: null,
      sizeBytes,
      mime: 'image/webp',
      totalChunks: 1,
      processedPaths: { photo: photoRel, thumb: thumbRel },
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: media.id })

  if (!row) throw new Error(`Не удалось создать медиа для фото «${slug}»`)
  return row.id
}
type ExerciseImportContext = {
  gymId: string
  machinesBySlug: Map<string, CatalogMachine>
  machineIds: Map<string, string>
  photoReady: Map<string, boolean>
  options: ImportOptions
  summary: ImportSummary
  log: (line: string) => void
}

/** Упражнения: upsert по `slug`, публикация только без `needsReview` и с готовым фото. */
async function importExercises(ctx: ExerciseImportContext): Promise<void> {
  const { gymId, machinesBySlug, machineIds, photoReady, options, summary, log } = ctx

  for (const item of KOLIZEY_EXERCISES) {
    const machine = machinesBySlug.get(item.machine)
    // Флаг тренажёра наследуется упражнениями: непроверенное фото не публикуем.
    const needsReview = Boolean(item.needsReview || machine?.needsReview)

    // Zod-схема каталога: ловит неизвестные коды мышц и конфликт primary/secondary.
    const parsed = exerciseInputSchema.parse({
      name: item.name,
      machineId: machineIds.get(item.machine) ?? null,
      primaryMuscles: item.primary,
      secondaryMuscles: item.secondary,
      videoMediaId: null,
      steps: item.steps,
      mistakes: item.mistakes,
      tips: item.tips,
      defaultRepMin: item.defaultRepMin,
      defaultRepMax: item.defaultRepMax,
      overlayProfile: item.overlayProfile,
    })

    const [existing] = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.gymId, gymId), eq(exercises.slug, item.slug)))
      .limit(1)

    // Упражнения с видео сняты Максимом — импорт их не переписывает.
    if (existing?.videoMediaId) {
      summary.exercisesSkippedWithVideo += 1
      log(`~ «${item.name}» пропущено: уже есть видео`)
      continue
    }

    let exerciseId: string

    if (existing) {
      await db.update(exercises).set({ ...parsed, updatedAt: new Date() }).where(eq(exercises.id, existing.id))

      exerciseId = existing.id
      summary.exercisesUpdated += 1
      log(`= «${item.name}» обновлено`)
    } else {
      const [created] = await db
        .insert(exercises)
        .values({ gymId, slug: item.slug, ...parsed, status: 'draft' })
        .returning({ id: exercises.id })

      if (!created) throw new Error(`Не удалось создать упражнение «${item.name}»`)
      exerciseId = created.id
      summary.exercisesCreated += 1
      log(`+ «${item.name}» — черновик`)
    }

    if (!options.publish) continue

    if (needsReview) {
      summary.needsReview.push(item.name)
      log(`? «${item.name}» остаётся черновиком: needsReview`)
      continue
    }

    if (!photoReady.get(item.machine)) {
      summary.notPublishable.push(item.name)
      log(`! «${item.name}» не публикуется: нет готового фото тренажёра`)
      continue
    }

    const [published] = await db
      .update(exercises)
      .set({ status: 'published', updatedAt: new Date() })
      .where(and(eq(exercises.id, exerciseId), eq(exercises.status, 'draft')))
      .returning({ id: exercises.id })

    if (published) {
      summary.exercisesPublished += 1
      log(`✓ «${item.name}» опубликовано`)
    }
  }
}



/**
 * Импорт каталога: сначала тренажёры с фото, потом упражнения.
 * Идемпотентен — повторный запуск обновляет строки и не создаёт дублей.
 */
export async function importCatalog(options: ImportOptions = {}): Promise<ImportSummary> {
  const log = options.log ?? ((): void => {})
  const photosDir = options.photosDir ?? DEFAULT_PHOTOS_DIR
  const summary = emptySummary()

  const problems = validateContent()
  if (problems.length > 0) {
    throw new Error(`Контент каталога не прошёл проверку:\n- ${problems.join('\n- ')}`)
  }

  const gym = await getGym()
  const ownerId = await resolveOwnerId()
  const machinesBySlug = new Map(KOLIZEY_MACHINES.map((machine) => [machine.slug, machine]))
  const machineIds = new Map<string, string>()
  const photoReady = new Map<string, boolean>()

  for (const machine of KOLIZEY_MACHINES) {
    const [existing] = await db
      .select()
      .from(machines)
      .where(
        and(eq(machines.gymId, gym.id), eq(machines.name, machine.name), isNull(machines.archivedAt)),
      )
      .limit(1)

    // Готовое фото переиспользуем: повторный запуск не плодит строки `media` и файлы.
    let photoMediaId = existing ? await findReadyPhoto(existing.photoMediaId) : null
    if (photoMediaId) {
      summary.photosReused += 1
    } else if (machine.photo) {
      photoMediaId = await importMachinePhoto(machine.slug, ownerId, photosDir)
      summary.photosImported += 1
    }
    photoReady.set(machine.slug, Boolean(photoMediaId))

    if (existing) {
      await db
        .update(machines)
        .set({
          zone: machine.zone,
          weightStepKg: machine.weightStepKg,
          photoMediaId: photoMediaId ?? existing.photoMediaId,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, existing.id))

      machineIds.set(machine.slug, existing.id)
      summary.machinesUpdated += 1
      log(`= тренажёр «${machine.name}» обновлён`)
    } else {
      const [created] = await db
        .insert(machines)
        .values({
          gymId: gym.id,
          name: machine.name,
          zone: machine.zone,
          weightStepKg: machine.weightStepKg,
          photoMediaId,
        })
        .returning({ id: machines.id })

      if (!created) throw new Error(`Не удалось создать тренажёр «${machine.name}»`)
      machineIds.set(machine.slug, created.id)
      summary.machinesCreated += 1
      log(`+ тренажёр «${machine.name}»${photoMediaId ? ' с фото' : ' без фото'}`)
    }
  }

  await importExercises({ gymId: gym.id, machinesBySlug, machineIds, photoReady, options, summary, log })

  return summary
}


async function main(): Promise<void> {
  const publish = process.argv.includes('--publish')
  console.log(`Импорт каталога «Колизей»${publish ? ' с публикацией' : ' — всё в черновики'}`)

  const summary = await importCatalog({ publish, log: (line) => console.log(line) })

  console.log(
    `\nТренажёры: создано ${summary.machinesCreated}, обновлено ${summary.machinesUpdated}; ` +
      `фото добавлено ${summary.photosImported}, переиспользовано ${summary.photosReused}`,
  )
  console.log(
    `Упражнения: создано ${summary.exercisesCreated}, обновлено ${summary.exercisesUpdated}, ` +
      `пропущено (есть видео) ${summary.exercisesSkippedWithVideo}, ` +
      `опубликовано ${summary.exercisesPublished}`,
  )

  if (summary.needsReview.length > 0) {
    console.log(
      `\nЧерновики с needsReview (${summary.needsReview.length}): ${summary.needsReview.join(', ')}`,
    )
  }
  if (summary.notPublishable.length > 0) {
    console.log(
      `\nНе опубликованы — нет готового фото тренажёра (${summary.notPublishable.length}): ` +
        summary.notPublishable.join(', '),
    )
  }
}

// Запускаем только при прямом вызове (`pnpm catalog:import`), не при импорте в тестах.
const isEntrypoint =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module

if (isEntrypoint) {
  main()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await client.end()
    })
}

