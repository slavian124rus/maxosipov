import { z } from 'zod'

const MAX_BIRTH_YEAR = new Date().getFullYear() - 14

/** Анкета клиента: DESIGN.md §8.7, ARCHITECTURE.md §7 (`client_profiles`). */
export const clientProfileSchema = z.object({
  sex: z.enum(['male', 'female']),
  birthYear: z.number().int().min(1940).max(MAX_BIRTH_YEAR),
  heightCm: z.number().int().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  goal: z.enum(['strength', 'mass', 'fat_loss', 'health']),
  experience: z.enum(['novice', 'intermediate', 'advanced']),
  sessionsPerWeek: z.number().int().min(1).max(7),
  limitations: z.string().max(500).nullish(),
  healthConsent: z.boolean(),
  pdConsent: z.literal(true),
})

export type ClientProfileInput = z.infer<typeof clientProfileSchema>
