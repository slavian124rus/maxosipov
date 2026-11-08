import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { addDays, addMonthsClamped, subscriptions, type SubscriptionStatus } from '@/modules/access'
import { users, type NewUser } from '@/modules/auth'
import { MUSCLES, exercises, machines, muscles, svgLayerId, type MuscleCode } from '@/modules/catalog'
import { gyms, type GymBrand, type GymSettings } from '@/modules/gym'
import { mediaDir, mediaRoot } from '@/modules/media'
import { DEFAULT_ROLES, roles, type Actor } from '@/modules/rbac'
import { copyTemplateToClient, programDays, programExercises, programs } from '@/modules/training'
import { client, db } from '@/shared/db'
import { media } from '@/shared/db/schema'
import { SEED_EXERCISES, SEED_MACHINES } from './seed-catalog'

const GYM_NAME = 'Колизей'

const BRAND: GymBrand = {
  name: 'Максим Осипов',
  shortName: 'МаксИИм',
  colors: { accent: '#E5322D' },
  logoUrl: null,
}

const SETTINGS: GymSettings = {
  trialDays: 30,
  subscriptionPriceRub: null,
  aiDailyLimit: 30,
  progressionRules: {
    sessionsToIncrease: 2,
    fastTrackOnEasy: true,
    failSessionsToDrop: 2,
    dropPercent: 10,
  },
  aiMemo: '',
  contacts: { phone: null, photoUrl: null },
}

const DEV_OWNER_PHONE = '+79990000001'
const DEV_TRAINER_PHONE = '+79990000002'
const DEV_CLIENT_PHONES = [
  '+79990000011',
  '+79990000012',
  '+79990000013',
  '+79990000014',
  '+79990000015',
]

const DEV_CLIENT_NAMES = [
  'Иван Петров',
  'Мария Соколова',
  'Дмитрий Кузнецов',
  'Анна Смирнова',
  'Сергей Волков',
]

export type SeedOptions = {
  /** В production создаём только зал, роли и пользователей из SEED_*. */
  production: boolean
  ownerPhone?: string | undefined
  trainerPhone?: string | undefined
}

export type SeedResult = {
  gymId: string
  roles: number
  users: number
}

async function ensureGym(): Promise<string> {
  const [existing] = await db.select().from(gyms).where(eq(gyms.name, GYM_NAME)).limit(1)
  if (existing) return existing.id

  const [created] = await db
    .insert(gyms)
    .values({
      name: GYM_NAME,
      address: 'Красноярск, ул. Говорова',
      brand: BRAND,
      settings: SETTINGS,
    })
    .returning()

  if (!created) throw new Error('Зал не создан')
  return created.id
}

async function ensureRoles(): Promise<Map<string, string>> {
  await db.insert(roles).values(DEFAULT_ROLES).onConflictDoNothing({ target: roles.name })

  const rows = await db.select().from(roles)
  return new Map(rows.map((role) => [role.name, role.id]))
}

/** Справочник мышц: вставляем и обновляем названия/стороны при каждом сиде. */
async function ensureMuscles(): Promise<number> {
  for (const muscle of MUSCLES) {
    await db
      .insert(muscles)
      .values({
        code: muscle.code,
        nameRu: muscle.nameRu,
        view: muscle.view,
        svgLayerId: svgLayerId(muscle.code),
      })
      .onConflictDoUpdate({
        target: muscles.code,
        set: { nameRu: muscle.nameRu, view: muscle.view, svgLayerId: svgLayerId(muscle.code) },
      })
  }

  return MUSCLES.length
}

/** Записывает главного тренера в настройки зала, если он ещё не задан. */
async function ensureHeadTrainer(gymId: string, trainerId: string): Promise<void> {
  const [gym] = await db.select().from(gyms).where(eq(gyms.id, gymId)).limit(1)
  if (!gym || gym.settings.headTrainerId) return
  await db
    .update(gyms)
    .set({ settings: { ...gym.settings, headTrainerId: trainerId } })
    .where(eq(gyms.id, gymId))
}

async function ensureUser(input: NewUser): Promise<string> {
  const [inserted] = await db
    .insert(users)
    .values(input)
    .onConflictDoNothing({ target: users.phone })
    .returning()

  if (inserted) return inserted.id

  const [existing] = await db.select().from(users).where(eq(users.phone, input.phone)).limit(1)
  if (!existing) throw new Error(`Не удалось создать пользователя ${input.phone}`)
  return existing.id
}

function roleId(roleIds: Map<string, string>, name: string): string {
  const id = roleIds.get(name)
  if (!id) throw new Error(`Роль «${name}» не найдена — сид ролей не выполнен`)
  return id
}

/**
 * Подписки тестовых клиентов: 1–3 пробные (25, 5, 1 день), 4 — оплачен на 2 месяца,
 * 5 — истёк 3 дня назад (для экрана «Продли у Максима»).
 */
async function ensureSubscriptions(clientIds: string[]): Promise<void> {
  const now = new Date()
  const plan: { status: SubscriptionStatus; endsAt: Date }[] = [
    { status: 'trial', endsAt: addDays(now, 25) },
    { status: 'trial', endsAt: addDays(now, 5) },
    { status: 'trial', endsAt: addDays(now, 1) },
    { status: 'active', endsAt: addMonthsClamped(now, 2, 'Asia/Krasnoyarsk') },
    { status: 'expired', endsAt: addDays(now, -3) },
  ]

  for (const [index, item] of plan.entries()) {
    const userId = clientIds[index]
    if (!userId) continue

    await db
      .insert(subscriptions)
      .values({ userId, status: item.status, startsAt: now, endsAt: item.endsAt })
      .onConflictDoNothing({ target: subscriptions.userId })
  }
}

/** Тестовый каталог: тренажёры, упражнения с видео из прототипа и черновики. */
async function ensureCatalog(gymId: string, ownerId: string): Promise<void> {
  const machineIds = new Map<string, string>()

  for (const machine of SEED_MACHINES) {
    const [existing] = await db
      .select({ id: machines.id })
      .from(machines)
      .where(eq(machines.name, machine.name))
      .limit(1)

    if (existing) {
      machineIds.set(machine.name, existing.id)
      continue
    }

    const [created] = await db
      .insert(machines)
      .values({ gymId, ...machine })
      .returning({ id: machines.id })

    if (created) machineIds.set(machine.name, created.id)
  }

  for (const exercise of SEED_EXERCISES) {
    const [existing] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.slug, exercise.slug))
      .limit(1)

    let videoMediaId: string | null = existing?.videoMediaId ?? null

    if (!videoMediaId && exercise.source && exercise.poster) {
      const id = randomUUID()
      const createdAt = new Date()
      const relDir = mediaDir({ id, createdAt })
      const dir = path.join(mediaRoot(), relDir)
      await mkdir(dir, { recursive: true })

      await copyFile(exercise.source, path.join(dir, 'video.mp4'))
      await copyFile(exercise.poster, path.join(dir, 'poster.jpg'))
      if (exercise.muscles) await copyFile(exercise.muscles, path.join(dir, 'muscles.mp4'))

      const [row] = await db
        .insert(media)
        .values({
          id,
          kind: 'exercise_video',
          ownerId,
          status: 'ready',
          sizeBytes: 0,
          mime: 'video/mp4',
          totalChunks: 1,
          processedPaths: {
            mp4: `${relDir}/video.mp4`,
            poster: `${relDir}/poster.jpg`,
            ...(exercise.muscles ? { musclesMp4: `${relDir}/muscles.mp4` } : {}),
          },
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: media.id })

      videoMediaId = row?.id ?? null
    }

    const values = {
      gymId,
      machineId: machineIds.get(exercise.machine) ?? null,
      name: exercise.name,
      slug: exercise.slug,
      primaryMuscles: exercise.primary as MuscleCode[],
      secondaryMuscles: exercise.secondary as MuscleCode[],
      videoMediaId,
      overlayProfile: exercise.profile,
      steps: exercise.steps,
      mistakes: exercise.mistakes,
      defaultRepMin: 10,
      defaultRepMax: 12,
      status: exercise.status,
    }

    if (existing) {
      await db
        .update(exercises)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(exercises.id, existing.id))
    } else {
      await db.insert(exercises).values(values)
    }
  }
}

/** Шаблон «Старт: 3 дня» и выдача его клиентам 1–4. */
const TEMPLATE_NAME = 'Старт: 3 дня'

const TEMPLATE_DAYS = [
  {
    name: 'День A — спина и бицепс',
    slugs: ['tyaga-verkhnego-bloka-k-grudi', 'tyaga-gorizontalnogo-bloka', 'podyom-shtangi-na-bitseps'],
  },
  { name: 'День B — ноги', slugs: ['zhim-nogami', 'razgibanie-nog'] },
  {
    name: 'День C — повтор A',
    slugs: ['tyaga-verkhnego-bloka-k-grudi', 'tyaga-gorizontalnogo-bloka', 'podyom-shtangi-na-bitseps'],
  },
]

async function ensureTraining(gymId: string, trainerId: string, trainerRoleId: string): Promise<void> {
  const [existingTemplate] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.name, TEMPLATE_NAME), isNull(programs.ownerId)))
    .limit(1)

  let templateId = existingTemplate?.id ?? null

  if (!templateId) {
    const [template] = await db
      .insert(programs)
      .values({ gymId, ownerId: null, authorId: trainerId, authorKind: 'trainer', name: TEMPLATE_NAME })
      .returning({ id: programs.id })

    if (!template) throw new Error('Шаблон не создан')
    templateId = template.id

    const catalog = await db
      .select({ id: exercises.id, slug: exercises.slug })
      .from(exercises)
      .where(inArray(exercises.slug, TEMPLATE_DAYS.flatMap((day) => day.slugs)))
    const bySlug = new Map(catalog.map((row) => [row.slug, row.id]))

    for (const [dayIndex, day] of TEMPLATE_DAYS.entries()) {
      const dayId = randomUUID()
      await db
        .insert(programDays)
        .values({ id: dayId, programId: templateId, name: day.name, order: dayIndex + 1 })

      const rows = day.slugs
        .map((slug, index) => ({ slug, index, exerciseId: bySlug.get(slug) }))
        .filter((row): row is { slug: string; index: number; exerciseId: string } => Boolean(row.exerciseId))
        .map((row) => ({
          dayId,
          order: row.index + 1,
          exerciseId: row.exerciseId,
          sets: row.slug === 'zhim-nogami' ? 4 : 3,
          repMin: 10,
          repMax: row.slug === 'razgibanie-nog' ? 15 : 12,
          restSec: 90,
        }))

      if (rows.length > 0) await db.insert(programExercises).values(rows)
    }
  }

  const actor: Actor = {
    id: trainerId,
    roleId: trainerRoleId,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.edit_programs', scope: 'all' }],
  }

  const clients = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.phone, DEV_CLIENT_PHONES.slice(0, 4)))

  for (const clientRow of clients) {
    const [active] = await db
      .select({ id: programs.id })
      .from(programs)
      .where(and(eq(programs.ownerId, clientRow.id), eq(programs.status, 'active')))
      .limit(1)

    if (!active) {
      await copyTemplateToClient(actor, templateId, clientRow.id, gymId)
    }
  }
}

/** Идемпотентный сид: зал, роли и пользователи. Возвращает количество созданных сущностей. */
export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const gymId = await ensureGym()
  const roleIds = await ensureRoles()
  await ensureMuscles()

  let createdUsers = 0

  if (options.production) {
    if (options.ownerPhone) {
      await ensureUser({
        phone: options.ownerPhone,
        name: 'Владелец',
        gymId,
        roleId: roleId(roleIds, 'Владелец'),
      })
      createdUsers += 1
    }

    if (options.trainerPhone) {
      const headTrainerId = await ensureUser({
        phone: options.trainerPhone,
        name: 'Максим Осипов',
        gymId,
        roleId: roleId(roleIds, 'Главный тренер'),
      })
      await ensureHeadTrainer(gymId, headTrainerId)
      createdUsers += 1
    }
  } else {
    await ensureUser({
      phone: DEV_OWNER_PHONE,
      name: 'Владелец зала',
      gymId,
      roleId: roleId(roleIds, 'Владелец'),
    })

    const trainerId = await ensureUser({
      phone: DEV_TRAINER_PHONE,
      name: 'Максим Осипов',
      gymId,
      roleId: roleId(roleIds, 'Главный тренер'),
    })
    await ensureHeadTrainer(gymId, trainerId)
    await ensureCatalog(gymId, trainerId)

    const clientIds: string[] = []
    for (const [index, phone] of DEV_CLIENT_PHONES.entries()) {
      const id = await ensureUser({
        phone,
        name: DEV_CLIENT_NAMES[index] ?? `Клиент ${index + 1}`,
        gymId,
        roleId: roleId(roleIds, 'Клиент'),
        trainerId,
      })
      clientIds.push(id)
    }

    // Программы выдаём после создания клиентов — иначе на чистой БД их никому не достанется.
    await ensureTraining(gymId, trainerId, roleId(roleIds, 'Главный тренер'))

    // Тестовые клиенты — «давно в зале»: анкета и согласия уже пройдены.
    const consentAt = new Date()
    await db
      .update(users)
      .set({ onboardingCompletedAt: consentAt, pdConsentAt: consentAt })
      .where(inArray(users.id, clientIds))

    await ensureSubscriptions(clientIds)

    createdUsers = 2 + DEV_CLIENT_PHONES.length
  }

  return { gymId, roles: roleIds.size, users: createdUsers }
}

async function main(): Promise<void> {
  const result = await runSeed({
    production: process.env.NODE_ENV === 'production',
    ownerPhone: process.env.SEED_OWNER_PHONE,
    trainerPhone: process.env.SEED_TRAINER_PHONE,
  })

  const [userCount] = await client<{ count: string }[]>`select count(*) from users`
  const [roleCount] = await client<{ count: string }[]>`select count(*) from roles`
  const [muscleCount] = await client<{ count: string }[]>`select count(*) from muscles`

  console.log(
    `Сид выполнен: зал «${GYM_NAME}», ролей ${roleCount?.count ?? 0}, мышц ${muscleCount?.count ?? 0}, пользователей ${userCount?.count ?? 0} (обработано ${result.users})`,
  )
}

// Запускаем только при прямом вызове (`pnpm db:seed`), не при импорте в тестах.
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

