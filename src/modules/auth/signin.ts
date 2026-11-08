import { and, eq } from 'drizzle-orm'
import { startTrialIfEligible } from '@/modules/access'
import { getGym, getHeadTrainerId } from '@/modules/gym'
import { roles } from '@/modules/rbac'
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
      .where(eq(roles.isClient, true))
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
        trainerId: await getHeadTrainerId(),
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
