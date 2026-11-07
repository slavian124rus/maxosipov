import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { addDays, addMonthsClamped, subscriptions, type SubscriptionStatus } from '@/modules/access'
import { users, type NewUser } from '@/modules/auth'
import { gyms, type GymBrand, type GymSettings } from '@/modules/gym'
import { DEFAULT_ROLES, roles } from '@/modules/rbac'
import { client, db } from '@/shared/db'

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

/** Идемпотентный сид: зал, роли и пользователи. Возвращает количество созданных сущностей. */
export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const gymId = await ensureGym()
  const roleIds = await ensureRoles()

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
      await ensureUser({
        phone: options.trainerPhone,
        name: 'Максим Осипов',
        gymId,
        roleId: roleId(roleIds, 'Главный тренер'),
      })
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

  console.log(
    `Сид выполнен: зал «${GYM_NAME}», ролей ${roleCount?.count ?? 0}, пользователей ${userCount?.count ?? 0} (обработано ${result.users})`,
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

