import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { roles } from '@/modules/rbac'
import { authAccounts, users } from './schema'
import { signInWithVerifiedPhone } from './signin'
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

test('один аккаунт Яндекса нельзя привязать к двум номерам', async () => {
  await signInWithVerifiedPhone('+79990000099', { provider: 'yandex', providerUserId: 'y1' })

  await expect(
    signInWithVerifiedPhone('+79990000098', { provider: 'yandex', providerUserId: 'y1' }),
  ).rejects.toThrow('Этот аккаунт Яндекса уже привязан к другому номеру')

  expect(await db.select().from(users)).toHaveLength(2)
})

test.each([
  ['vk', 'VK ID'],
] as const)('текст ошибки для провайдера %s', async (provider, title) => {
  await signInWithVerifiedPhone('+79990000099', { provider, providerUserId: 'p1' })

  await expect(
    signInWithVerifiedPhone('+79990000098', { provider, providerUserId: 'p1' }),
  ).rejects.toThrow(`Этот аккаунт ${title} уже привязан к другому номеру`)
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
