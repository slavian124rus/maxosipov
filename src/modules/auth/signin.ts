import { and, eq } from 'drizzle-orm'
import { startTrialIfEligible, subscriptions } from '@/modules/access'
import { getGym, getHeadTrainerId } from '@/modules/gym'
import { notify } from '@/modules/notifications'
import { roles } from '@/modules/rbac'
import { db } from '@/shared/db'
import { canonicalEmail, normalizeEmail } from './email'
import { authAccounts, users, type AuthProvider } from './schema'

export type SignInLink = {
  provider: Exclude<AuthProvider, 'phone' | 'email'>
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

type Identity = { field: 'phone' | 'email'; value: string }

async function findUserIdByIdentity({ field, value }: Identity): Promise<string | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users[field], value)).limit(1)
  return row?.id ?? null
}

function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause]
  return candidates.some(
    (item) =>
      typeof item === 'object' && item !== null && (item as { code?: string }).code === '23505',
  )
}

/**
 * Создаёт клиента. Двойной тап «Войти» даёт две параллельные вставки одного контакта —
 * вторая упирается в уникальность, тогда просто читаем созданного (ревью F7).
 */
async function createClient(
  identity: Identity,
  name: string,
): Promise<{ userId: string; isNew: boolean }> {
  const gym = await getGym()
  const [clientRole] = await db.select().from(roles).where(eq(roles.isClient, true)).limit(1)
  if (!clientRole) {
    throw new Error('Роль клиента не найдена — сид ролей не выполнен')
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        [identity.field]: identity.value,
        name,
        gymId: gym.id,
        roleId: clientRole.id,
        trainerId: await getHeadTrainerId(),
      })
      .returning({ id: users.id })
    if (!created) throw new Error('Пользователь не создан')
    return { userId: created.id, isNew: true }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const existing = await findUserIdByIdentity(identity)
    if (!existing) throw error
    return { userId: existing, isNew: false }
  }
}

/**
 * Общий вход с подтверждённым контактом (телефон или почта): находит или создаёт пользователя,
 * привязывает способы входа и (для нового) включает пробный период.
 * Если аккаунт провайдера уже привязан — входит в привязанного пользователя (контакт не сверяется).
 */
async function signInWithIdentity(
  identity: Identity,
  trialKey: string,
  link?: SignInLink,
): Promise<SignInResult> {
  if (link) {
    // Аккаунт провайдера уже привязан к пользователю — входим в него, какой бы контакт пришёл
    // сейчас. Привязка не переносится: чужой контакт в профиле провайдера не открывает чужой аккаунт.
    const boundUserId = await findUserIdByLink(link)
    if (boundUserId) return { userId: boundUserId, isNew: false }
  }

  let userId: string
  let isNew = false

  const existing = await findUserIdByIdentity(identity)
  if (existing) {
    userId = existing
  } else {
    const created = await createClient(identity, link?.name ?? '')
    userId = created.userId
    isNew = created.isNew
  }

  await attachAccount(userId, identity.field, identity.value)
  if (link) await attachAccount(userId, link.provider, link.providerUserId)

  if (isNew) {
    const started = await startTrialIfEligible(userId, trialKey)
    if (started) await notifyNewClient(userId)
  }

  return { userId, isNew }
}

/** Вход с подтверждённым телефоном. */
export function signInWithVerifiedPhone(phone: string, link?: SignInLink): Promise<SignInResult> {
  return signInWithIdentity({ field: 'phone', value: phone }, phone, link)
}

/** Вход с подтверждённой почтой. Пробный период — один на канонический адрес. */
export function signInWithVerifiedEmail(email: string, link?: SignInLink): Promise<SignInResult> {
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error('Некорректная почта')
  return signInWithIdentity(
    { field: 'email', value: normalized },
    `email:${canonicalEmail(normalized)}`,
    link,
  )
}

/** «Новый клиент» тренеру: имя и дата конца пробного периода. */
async function notifyNewClient(userId: string): Promise<void> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return

    const trainerId = user.trainerId ?? (await getHeadTrainerId())
    if (!trainerId) return

    const [subscription] = await db
      .select({ endsAt: subscriptions.endsAt })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    await notify(trainerId, 'new_client', {
      name: user.name || 'Клиент',
      clientId: userId,
      trialUntil: subscription?.endsAt.toISOString(),
    })
  } catch (error) {
    console.error('[auth] не удалось уведомить о новом клиенте', error)
  }
}
