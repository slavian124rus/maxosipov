import { z } from 'zod'

/**
 * Валидация переменных окружения (ARCHITECTURE.md §17).
 * Пустая строка из `.env` считается «не задано».
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const requiredString = (name: string) =>
  z.preprocess(emptyToUndefined, z.string().min(1, `${name} обязателен`))

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional())

const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // База данных
  DATABASE_URL: requiredString('DATABASE_URL'),
  TEST_DATABASE_URL: optionalUrl,

  // Адреса
  APP_URL: z.preprocess(emptyToUndefined, z.url().default('http://app.localhost:3000')),
  SITE_URL: z.preprocess(emptyToUndefined, z.url().default('http://localhost:3000')),

  // Безопасность
  AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, 'AUTH_SECRET должен быть не короче 32 символов'),
  ),

  // Вход
  VK_CLIENT_ID: optionalString,
  VK_CLIENT_SECRET: optionalString,
  YANDEX_CLIENT_ID: optionalString,
  YANDEX_CLIENT_SECRET: optionalString,
  MAX_BOT_TOKEN: optionalString,
  MAX_WEBHOOK_SECRET: optionalString,

  // СМС
  SMS_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['smsru', 'console']).default('console')),
  SMS_API_KEY: optionalString,

  // ИИ
  AI_BASE_URL: z.preprocess(emptyToUndefined, z.url().default('https://plusvibeapi.ru/v1')),
  AI_API_KEY: optionalString,
  AI_MODEL_MAIN: optionalString,
  AI_MODEL_FAST: optionalString,
  AI_MODEL_FALLBACK: optionalString,

  // Распознавание речи
  STT_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['plusvibe', 'yandex']).optional()),
  STT_MODEL: optionalString,
  YANDEX_SPEECHKIT_KEY: optionalString,

  // Push
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,

  // Медиа
  MEDIA_ROOT: z.preprocess(emptyToUndefined, z.string().min(1).default('/data/media')),
  MEDIA_URL_SIGNING_SECRET: optionalString,

  // Бэкапы
  BACKUP_S3_ENDPOINT: optionalUrl,
  BACKUP_S3_BUCKET: optionalString,
  BACKUP_S3_KEY: optionalString,
  BACKUP_S3_SECRET: optionalString,
  RESTIC_PASSWORD: optionalString,

  // Сид
  SEED_OWNER_PHONE: optionalString,
  SEED_TRAINER_PHONE: optionalString,
})

/**
 * Проверки, которые нельзя выразить одной схемой: `SMS_API_KEY` обязателен для СМС.ру.
 */
function refineEnv(data: z.infer<typeof envSchema>, ctx: z.RefinementCtx): void {
  if (data.SMS_PROVIDER === 'smsru' && !data.SMS_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMS_API_KEY'],
      message: 'SMS_API_KEY обязателен при SMS_PROVIDER=smsru',
    })
  }
}

export type Env = z.infer<typeof envSchema>

const fullEnvSchema = envSchema.superRefine(refineEnv)

/**
 * Разбирает окружение и бросает понятную ошибку со списком проблемных переменных.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = fullEnvSchema.safeParse(raw)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Неверные переменные окружения:\n${details}`)
  }

  return result.data
}

export const env: Env = parseEnv(process.env)
