import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { clientProfiles, users } from './schema'
import { clientProfileSchema, type ClientProfileInput } from './profile-schema'

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
