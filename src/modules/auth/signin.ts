import { and, eq } from 'drizzle-orm'
import { getGym } from '@/modules/gym'
import { CLIENT_ROLE_NAME, roles } from '@/modules/rbac'
import { db } from '@/shared/db'
import { authAccounts, users, type AuthProvider } from './schema'

/** Как называем провайдера в текстах для человека. */
const PROVIDER_TITLES: Record<Exclude<AuthProvider, 'phone'>, string> = {
  vk: 'VK ID',
  yandex: 'Яндекса',
  max: 'MAX',
}

export type SignInLink = {
  provider: Exclude<AuthProvider, 'phone'>
  providerUserId: string
  name?: string
}

export type SignInResult = { userId: string; isNew: boolean }

/**
 * Заглушка до задачи 5: пробный период включится вместе с модулем `access`.
 * Сигнатура уже финальная, чтобы не менять вызывающий код.
 */
async function startTrialIfEligible(userId: string, phone: string): Promise<boolean> {
  void userId
  void phone
  return false
}

async function findUserIdByLink(link: SignInLink): Promise<string | null> {
  const [account] = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, link.provider),
        eq(authAccounts.providerUserId, link.providerUserId),
      ),
    )
    .limit(1)

  return account?.userId ?? null
}

async function attachAccount(
  userId: string,
  provider: AuthProvider,
  providerUserId: string,
): Promise<void> {
  await db
    .insert(authAccounts)
    .values({ userId, provider, providerUserId })
    .onConflictDoNothing({
      target: [authAccounts.provider, authAccounts.providerUserId],
    })
}

async function findFirstTrainerId(gymId: string): Promise<string | null> {
  const [trainerRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, 'Главный тренер'))
    .limit(1)

  if (!trainerRole) return null

  const [trainer] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.roleId, trainerRole.id), eq(users.gymId, gymId)))
    .limit(1)

  return trainer?.id ?? null
}

/**
 * Вход с подтверждённым телефоном: находит или создаёт пользователя,
 * привязывает способы входа и (для нового) включает пробный период.
 */
export async function signInWithVerifiedPhone(
  phone: string,
  link?: SignInLink,
): Promise<SignInResult> {
  if (link) {
    const boundUserId = await findUserIdByLink(link)

    if (boundUserId) {
      const [boundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, boundUserId))
        .limit(1)

      if (boundUser && boundUser.phone !== phone) {
        throw new Error(
          `Этот аккаунт ${PROVIDER_TITLES[link.provider]} уже привязан к другому номеру`,
        )
      }
    }
  }

  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1)

  let userId: string
  let isNew = false

  if (existing) {
    userId = existing.id
  } else {
    const gym = await getGym()
    const [clientRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, CLIENT_ROLE_NAME))
      .limit(1)

    if (!clientRole) {
      throw new Error('Роль «Клиент» не найдена — сид ролей не выполнен')
    }

    const [created] = await db
      .insert(users)
      .values({
        phone,
        name: link?.name ?? '',
        gymId: gym.id,
        roleId: clientRole.id,
        trainerId: await findFirstTrainerId(gym.id),
      })
      .returning()

    if (!created) throw new Error('Пользователь не создан')

    userId = created.id
    isNew = true
  }

  await attachAccount(userId, 'phone', phone)
  if (link) await attachAccount(userId, link.provider, link.providerUserId)

  if (isNew) {
    await startTrialIfEligible(userId, phone)
  }

  return { userId, isNew }
}
