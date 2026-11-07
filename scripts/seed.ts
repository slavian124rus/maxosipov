import 'dotenv/config'
import { eq } from 'drizzle-orm'
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

async function main(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production'

  const gymId = await ensureGym()
  const roleIds = await ensureRoles()

  let created = 0

  if (isProduction) {
    // На продакшне тестовые номера не создаём: только зал, роли и явно указанные люди.
    const ownerPhone = process.env.SEED_OWNER_PHONE
    const trainerPhone = process.env.SEED_TRAINER_PHONE

    if (ownerPhone) {
      await ensureUser({
        phone: ownerPhone,
        name: 'Владелец',
        gymId,
        roleId: roleId(roleIds, 'Владелец'),
      })
      created += 1
    }

    if (trainerPhone) {
      await ensureUser({
        phone: trainerPhone,
        name: 'Максим Осипов',
        gymId,
        roleId: roleId(roleIds, 'Главный тренер'),
      })
      created += 1
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

    for (const [index, phone] of DEV_CLIENT_PHONES.entries()) {
      await ensureUser({
        phone,
        name: DEV_CLIENT_NAMES[index] ?? `Клиент ${index + 1}`,
        gymId,
        roleId: roleId(roleIds, 'Клиент'),
        trainerId,
      })
    }

    created = 2 + DEV_CLIENT_PHONES.length
  }

  const [userCount] = await client<{ count: string }[]>`select count(*) from users`
  const [roleCount] = await client<{ count: string }[]>`select count(*) from roles`

  console.log(
    `Сид выполнен: зал «${GYM_NAME}», ролей ${roleCount?.count ?? 0}, пользователей ${userCount?.count ?? 0} (обработано ${created})`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end()
  })
