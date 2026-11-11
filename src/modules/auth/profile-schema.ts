import { z } from 'zod'

const MAX_BIRTH_YEAR = new Date().getFullYear() - 14

/** Имя человека: как подписываться в приложении и в кабинете тренера. */
export const userNameSchema = z
  .string()
  .trim()
  .min(2, 'Имя слишком короткое')
  .max(60, 'Имя слишком длинное (до 60 символов)')

/**
 * Анкета, которую клиент правит уже после регистрации: те же поля, но без повторных
 * согласий — согласие на ПДн и здоровье даётся один раз при онбординге.
 */
export const profileDetailsSchema = z.object({
  name: userNameSchema,
  sex: z.enum(['male', 'female']),
  birthYear: z.number().int().min(1940).max(MAX_BIRTH_YEAR),
  heightCm: z.number().int().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  goal: z.enum(['strength', 'mass', 'fat_loss', 'health']),
  experience: z.enum(['novice', 'intermediate', 'advanced']),
  sessionsPerWeek: z.number().int().min(1).max(7),
  limitations: z.string().max(500).nullish(),
  /** Согласие на обработку данных о здоровье: без него ограничения не сохраняются. */
  healthConsent: z.boolean(),
})

export type ProfileDetailsInput = z.infer<typeof profileDetailsSchema>

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
