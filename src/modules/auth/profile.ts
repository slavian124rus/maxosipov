import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { clientProfiles, users, type ClientProfile } from './schema'
import {
  clientProfileSchema,
  profileDetailsSchema,
  userNameSchema,
  type ClientProfileInput,
  type ProfileDetailsInput,
} from './profile-schema'

/** Анкета клиента (или `null`, если онбординг не пройден). */
export async function getClientProfile(userId: string): Promise<ClientProfile | null> {
  const [row] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1)

  return row ?? null
}

/**
 * Сохраняет анкету: профиль, согласия и отметку о завершении онбординга.
 * Ограничения по здоровью пишутся только при согласии на их обработку.
 */
export async function saveOnboarding(
  userId: string,
  input: ClientProfileInput,
  contact?: { phone: string },
): Promise<void> {
  const data = clientProfileSchema.parse(input)
  const now = new Date()
  const limitations = data.healthConsent ? (data.limitations ?? null) : null

  const values = {
    userId,
    sex: data.sex,
    birthYear: data.birthYear,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    goal: data.goal,
    experience: data.experience,
    sessionsPerWeek: data.sessionsPerWeek,
    limitations,
    healthConsentAt: data.healthConsent ? now : null,
    updatedAt: now,
  }

  await db
    .insert(clientProfiles)
    .values(values)
    .onConflictDoUpdate({ target: clientProfiles.userId, set: values })

  await db
    .update(users)
    .set({ pdConsentAt: now, onboardingCompletedAt: now, updatedAt: now })
    .where(eq(users.id, userId))

  if (contact) await saveContactPhone(userId, contact.phone)
}

/**
 * Меняет только имя: его правит и сам человек в профиле, и тренер в карточке клиента.
 * Возвращает сохранённое (обрезанное) имя.
 */
export async function updateUserName(userId: string, rawName: string): Promise<string> {
  const name = userNameSchema.parse(rawName)

  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId))

  return name
}

/**
 * Клиент правит свои данные сам (DESIGN.md §8.1 «Профиль»): имя и анкету.
 * Согласия не трогаем — они даны при онбординге; ограничения пишем только если
 * согласие на здоровье уже есть, иначе поле остаётся пустым.
 */
export async function saveProfileDetails(
  userId: string,
  input: ProfileDetailsInput,
): Promise<void> {
  const data = profileDetailsSchema.parse(input)
  const now = new Date()

  const existing = await getClientProfile(userId)
  // Согласие на здоровье можно дать (и отозвать) в профиле. Отозвали — данные о здоровье стираем.
  const healthConsentAt = data.healthConsent ? (existing?.healthConsentAt ?? now) : null
  const limitations = healthConsentAt ? (data.limitations ?? null) : null

  const values = {
    userId,
    sex: data.sex,
    birthYear: data.birthYear,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    goal: data.goal,
    experience: data.experience,
    sessionsPerWeek: data.sessionsPerWeek,
    limitations,
    healthConsentAt,
    updatedAt: now,
  }

  await db
    .insert(clientProfiles)
    .values(values)
    .onConflictDoUpdate({ target: clientProfiles.userId, set: values })

  await db
    .update(users)
    .set({ name: data.name, updatedAt: now })
    .where(eq(users.id, userId))
}

/**
 * Сохраняет телефон, если он свободен: чужой номер молча пропускаем (контакт не подтверждён).
 */
async function saveContactPhone(userId: string, phone: string): Promise<void> {
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
  if (taken) return
  await db
    .update(users)
    .set({ phone, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.phone)))
    .catch((error: unknown) => {
      const code = (error as { code?: string; cause?: { code?: string } } | null)
      if (code?.code === '23505' || code?.cause?.code === '23505') return
      throw error
    })
}
