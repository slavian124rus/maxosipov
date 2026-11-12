import { z } from 'zod'
import { isMuscleCode, type MuscleCode } from './muscles'

/** Код мышцы: проверяем по справочнику и сохраняем узкий тип `MuscleCode`. */
const muscleCodeSchema = z
  .string()
  .refine((value): value is MuscleCode => isMuscleCode(value), 'Неизвестная мышца') as z.ZodType<MuscleCode>

/** Входные данные упражнения (Zod — одна схема для формы и сервера). */
export const exerciseInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Название слишком короткое').max(120),
    machineId: z.string().uuid().nullable(),
    primaryMuscles: z.array(muscleCodeSchema).max(10),
    secondaryMuscles: z.array(muscleCodeSchema).max(15),
    videoMediaId: z.string().uuid().nullable(),
    steps: z.array(z.string().trim().min(1)).max(10),
    mistakes: z.array(z.string().trim().min(1)).max(10),
    tips: z.string().trim().max(500).nullable(),
    defaultRepMin: z.number().int().min(1).max(50),
    defaultRepMax: z.number().int().min(1).max(50),
    overlayProfile: z.enum(['none', 'pull_vertical', 'pull_horizontal']),
  })
  .refine((data) => data.defaultRepMax >= data.defaultRepMin, {
    message: 'Максимум повторений меньше минимума',
    path: ['defaultRepMax'],
  })
  .refine(
    (data) => data.primaryMuscles.every((code) => !data.secondaryMuscles.includes(code)),
    { message: 'Мышца не может быть одновременно основной и помогающей', path: ['secondaryMuscles'] },
  )

export type ExerciseInput = z.infer<typeof exerciseInputSchema>

export const machineInputSchema = z.object({
  name: z.string().trim().min(2, 'Название слишком короткое').max(120, 'Название слишком длинное'),
  zone: z.string().trim().max(60, 'Зона — до 60 символов').nullable(),
  /**
   * Шаг веса. `0` — «без веса»: кардио и тренажёры, где вес не задаётся
   * (прогрессия такие машины пропускает: `recommend` при `stepKg <= 0` не советует вес).
   */
  weightStepKg: z
    .number()
    .min(0, 'Шаг веса — от 0 до 50 кг. Для кардио выбери «Без веса»')
    .max(50, 'Шаг веса — не больше 50 кг'),
  photoMediaId: z.string().uuid('Фото не найдено').nullable(),
})

export type MachineInput = z.infer<typeof machineInputSchema>
