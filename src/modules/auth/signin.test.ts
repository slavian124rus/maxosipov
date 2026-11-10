import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { roles } from '@/modules/rbac'
import { authAccounts, users } from './schema'
import { signInWithVerifiedEmail, signInWithVerifiedPhone } from './signin'
import { subscriptions } from '@/modules/access'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'

let trainerId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const seeded = await seedDefaultRoles()

  await db.insert(gyms).values({
    name: 'Колизей',
    address: 'Красноярск, ул. Говорова',
    brand: { name: 'Максим Осипов', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null },
    settings: {
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
    },
  })

  const gym = (await db.select().from(gyms).limit(1))[0]!
  const [trainer] = await db
    .insert(users)
    .values({
      phone: '+79990000002',
      name: 'Максим Осипов',
      gymId: gym.id,
      roleId: seeded['Главный тренер']!.id,
    })
    .returning()
  trainerId = trainer!.id
  await db
    .update(gyms)
    .set({ settings: { ...gym.settings, headTrainerId: trainerId } })
    .where(eq(gyms.id, gym.id))
})

test('новый номер создаёт клиента с ролью «Клиент» и тренером Максимом', async () => {
  const result = await signInWithVerifiedPhone('+79990000099')

  expect(result.isNew).toBe(true)

  const [user] = await db.select().from(users).where(eq(users.id, result.userId))
  expect(user?.phone).toBe('+79990000099')
  expect(user?.trainerId).toBe(trainerId)

  const [clientRole] = await db.select().from(roles).where(eq(roles.name, 'Клиент'))
  expect(user?.roleId).toBe(clientRole?.id)
})

test('повторный вход тем же номером не создаёт второго пользователя', async () => {
  const first = await signInWithVerifiedPhone('+79990000099')
  const second = await signInWithVerifiedPhone('+79990000099')

  expect(first.isNew).toBe(true)
  expect(second.isNew).toBe(false)
  expect(second.userId).toBe(first.userId)
  expect(await db.select().from(users)).toHaveLength(2)
})

test('вход через Яндекс с существующим номером привязывает способ входа', async () => {
  const first = await signInWithVerifiedPhone('+79990000099')
  const second = await signInWithVerifiedPhone('+79990000099', {
    provider: 'yandex',
    providerUserId: 'y1',
    name: 'Иван',
  })

  expect(second.userId).toBe(first.userId)

  const accounts = await db.select().from(authAccounts).where(eq(authAccounts.userId, first.userId))
  expect(accounts.map((account) => `${account.provider}/${account.providerUserId}`).sort()).toEqual([
    'phone/+79990000099',
    'yandex/y1',
  ])
})

test('аккаунт Яндекса уже привязан к другому номеру — входим в привязанный аккаунт, без ошибки', async () => {
  const first = await signInWithVerifiedPhone('+79990000099', { provider: 'yandex', providerUserId: 'y1' })
  const usersBefore = (await db.select().from(users)).length

  const again = await signInWithVerifiedPhone('+79990000098', { provider: 'yandex', providerUserId: 'y1' })

  expect(again.userId).toBe(first.userId)
  expect(again.isNew).toBe(false)
  // Второй номер не создаёт нового пользователя и не меняет номер привязанного.
  expect(await db.select().from(users)).toHaveLength(usersBefore)
  const [bound] = await db.select().from(users).where(eq(users.id, first.userId))
  expect(bound?.phone).toBe('+79990000099')
})

test('то же для VK ID: привязанный аккаунт открывается при любом подтверждённом номере', async () => {
  const first = await signInWithVerifiedPhone('+79990000099', { provider: 'vk', providerUserId: 'p1' })
  const usersBefore = (await db.select().from(users)).length

  const again = await signInWithVerifiedPhone('+79990000098', { provider: 'vk', providerUserId: 'p1' })

  expect(again.userId).toBe(first.userId)
  expect(await db.select().from(users)).toHaveLength(usersBefore)
})

test('вход по VK, затем по Яндексу с другим номером — ошибки нет, Яндекс привязан к своему аккаунту', async () => {
  const viaVk = await signInWithVerifiedPhone('+79990000011', { provider: 'vk', providerUserId: 'v1' })
  const viaYandexFirst = await signInWithVerifiedPhone('+79990000022', { provider: 'yandex', providerUserId: 'y1' })

  // Яндекс уже привязан к номеру …022; теперь приходит номер …011 (как у VK) — раньше это была ошибка.
  const viaYandexAgain = await signInWithVerifiedPhone('+79990000011', { provider: 'yandex', providerUserId: 'y1' })

  expect(viaYandexAgain.userId).toBe(viaYandexFirst.userId)
  expect(viaYandexAgain.userId).not.toBe(viaVk.userId)
})

test('Яндекс, затем VK с тем же номером — один аккаунт с двумя способами входа', async () => {
  const viaYandex = await signInWithVerifiedPhone('+79991234567', {
    provider: 'yandex',
    providerUserId: 'y1',
  })
  const viaVk = await signInWithVerifiedPhone('+79991234567', {
    provider: 'vk',
    providerUserId: 'v1',
  })

  expect(viaVk.userId).toBe(viaYandex.userId)
  expect(viaVk.isNew).toBe(false)

  const accounts = await db
    .select()
    .from(authAccounts)
    .where(eq(authAccounts.userId, viaYandex.userId))

  expect(accounts.map((account) => account.provider).sort()).toEqual(['phone', 'vk', 'yandex'])
})

test('роль главного тренера переименована — новый клиент всё равно получает Максима', async () => {
  await db.update(roles).set({ name: 'Старший тренер' }).where(eq(roles.name, 'Главный тренер'))

  const result = await signInWithVerifiedPhone('+79990000098')
  const [user] = await db.select().from(users).where(eq(users.id, result.userId))
  expect(user?.trainerId).toBe(trainerId)
})

test('двойной тап: два параллельных входа одного нового номера — один пользователь, без ошибки', async () => {
  const results = await Promise.all([
    signInWithVerifiedPhone('+79990000097'),
    signInWithVerifiedPhone('+79990000097'),
  ])
  expect(results[0].userId).toBe(results[1].userId)
  const rows = await db.select().from(users).where(eq(users.phone, '+79990000097'))
  expect(rows).toHaveLength(1)
})


test('вход по почте: новый клиент без телефона, пробный период и способ входа email', async () => {
  const result = await signInWithVerifiedEmail('Ivan@Example.com')
  expect(result.isNew).toBe(true)

  const [user] = await db.select().from(users).where(eq(users.id, result.userId))
  expect(user?.email).toBe('ivan@example.com')
  expect(user?.phone).toBeNull()
  expect(user?.trainerId).toBe(trainerId)

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, result.userId))
  expect(subs).toHaveLength(1)
  expect(subs[0]?.status).toBe('trial')

  const accounts = await db.select().from(authAccounts).where(eq(authAccounts.userId, result.userId))
  expect(accounts.map((a) => `${a.provider}/${a.providerUserId}`)).toEqual(['email/ivan@example.com'])
})

test('повторный вход по почте — тот же пользователь', async () => {
  const first = await signInWithVerifiedEmail('ivan@example.com')
  const second = await signInWithVerifiedEmail('IVAN@example.com')
  expect(second.userId).toBe(first.userId)
  expect(second.isNew).toBe(false)
})

test('пробный период один на канонический адрес: gmail с точками и +тегом не даёт второй', async () => {
  const first = await signInWithVerifiedEmail('ivan.petrov@gmail.com')
  const second = await signInWithVerifiedEmail('ivanpetrov+x@gmail.com')
  expect(second.userId).not.toBe(first.userId)
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, second.userId))
  expect(subs).toHaveLength(0)
})

test('привязанный аккаунт Яндекса открывается при любой почте', async () => {
  const first = await signInWithVerifiedEmail('a@example.com', { provider: 'yandex', providerUserId: 'y9' })
  const again = await signInWithVerifiedEmail('b@example.com', { provider: 'yandex', providerUserId: 'y9' })
  expect(again.userId).toBe(first.userId)
  expect(again.isNew).toBe(false)
})

test('двойной тап: два параллельных входа новой почтой — один пользователь', async () => {
  const results = await Promise.all([
    signInWithVerifiedEmail('dbl@example.com'),
    signInWithVerifiedEmail('dbl@example.com'),
  ])
  expect(results[0].userId).toBe(results[1].userId)
  expect(await db.select().from(users).where(eq(users.email, 'dbl@example.com'))).toHaveLength(1)
})
