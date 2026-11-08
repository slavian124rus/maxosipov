import { z } from 'zod'
import { MUSCLES } from './muscles'

const muscleCodes = MUSCLES.map((muscle) => muscle.code) as [string, ...string[]]

const muscleCodeSchema = z.enum(muscleCodes)

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
  name: z.string().trim().min(2, 'Название слишком короткое').max(120),
  zone: z.string().trim().max(60).nullable(),
  weightStepKg: z.number().min(0.5).max(50),
  photoMediaId: z.string().uuid().nullable(),
})

export type MachineInput = z.infer<typeof machineInputSchema>
