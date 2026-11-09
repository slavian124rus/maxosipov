import { z } from 'zod'

/** Не больше одного знака после запятой (вес и сантиметры). */
const oneDecimal = (value: number): boolean => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9

const decimal = (min: number, max: number, label: string) =>
  z
    .number()
    .min(min, `${label} должен быть от ${min} до ${max}`)
    .max(max, `${label} должен быть от ${min} до ${max}`)
    .refine(oneDecimal, `${label}: не больше одного знака после запятой`)

const optionalDecimal = (min: number, max: number, label: string) =>
  z.union([decimal(min, max, label), z.null()]).optional()

/** Замер тела: дата `YYYY-MM-DD` и хотя бы одно числовое поле. */
export const measurementInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД'),
    weightKg: optionalDecimal(30, 300, 'Вес'),
    chestCm: optionalDecimal(30, 250, 'Грудь'),
    waistCm: optionalDecimal(30, 250, 'Талия'),
    hipsCm: optionalDecimal(30, 250, 'Бёдра'),
    bicepsCm: optionalDecimal(10, 120, 'Бицепс'),
    thighCm: optionalDecimal(10, 120, 'Бедро'),
  })
  .refine(
    (data) =>
      [data.weightKg, data.chestCm, data.waistCm, data.hipsCm, data.bicepsCm, data.thighCm].some(
        (value) => typeof value === 'number',
      ),
    { message: 'Заполни хотя бы одно поле', path: ['weightKg'] },
  )

export type MeasurementInput = z.infer<typeof measurementInputSchema>