import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { clientProfiles, users, type ClientProfile } from './schema'
import { clientProfileSchema, type ClientProfileInput } from './profile-schema'

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
}
