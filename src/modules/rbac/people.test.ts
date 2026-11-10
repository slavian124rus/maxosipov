import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { gyms } from '@/modules/gym'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { ForbiddenError } from './errors'
import type { Actor } from './check'
import { setClientTrainer } from './people'
import { roleAudit } from './schema'

let owner: Actor
let trainerId: string
let clientId: string
let otherClientId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()

  const [gym] = await db
    .insert(gyms)
    .values({
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
    .returning()

  const make = async (phone: string, name: string, role: string) => {
    const [row] = await db
      .insert(users)
      .values({ phone, name, gymId: gym!.id, roleId: roles[role]!.id })
      .returning()
    return row!
  }

  const ownerRow = await make('+79990000001', 'Владелец', 'Владелец')
  trainerId = (await make('+79990000002', 'Максим', 'Главный тренер')).id
  clientId = (await make('+79990000011', 'Иван', 'Клиент')).id
  otherClientId = (await make('+79990000012', 'Мария', 'Клиент')).id

  owner = { id: ownerRow.id, roleId: roles['Владелец']!.id, gymId: gym!.id, isOwner: true, permissions: [] }
})

test('клиенту назначается тренер-сотрудник, действие попадает в журнал; снять тренера тоже можно', async () => {
  await setClientTrainer(owner, clientId, trainerId)

  const [client] = await db.select().from(users).where(eq(users.id, clientId))
  expect(client?.trainerId).toBe(trainerId)

  const audit = await db.select().from(roleAudit)
  expect(audit).toHaveLength(1)
  expect(audit[0]?.action).toBe('trainer.assign')
  expect(audit[0]?.target).toBe(clientId)

  await setClientTrainer(owner, clientId, null)
  const [after] = await db.select().from(users).where(eq(users.id, clientId))
  expect(after?.trainerId).toBeNull()
})

test('тренером нельзя назначить клиента или несуществующего человека', async () => {
  await expect(setClientTrainer(owner, clientId, otherClientId)).rejects.toThrow(
    'Тренером может быть только сотрудник зала',
  )
  await expect(
    setClientTrainer(owner, clientId, '99999999-9999-4999-8999-999999999999'),
  ).rejects.toThrow('Тренер не найден')

  const [client] = await db.select().from(users).where(eq(users.id, clientId))
  expect(client?.trainerId).toBeNull()
})

test('тренера привязывают только к клиенту, не к сотруднику и не к несуществующему пользователю', async () => {
  await expect(setClientTrainer(owner, trainerId, trainerId)).rejects.toThrow(
    'Тренера можно назначить только клиенту',
  )
  await expect(
    setClientTrainer(owner, '99999999-9999-4999-8999-999999999999', trainerId),
  ).rejects.toThrow('Пользователь не найден')
})

test('без права users.assign_roles привязать тренера нельзя', async () => {
  const nobody: Actor = { ...owner, isOwner: false, permissions: [] }
  await expect(setClientTrainer(nobody, clientId, trainerId)).rejects.toBeInstanceOf(ForbiddenError)
})
