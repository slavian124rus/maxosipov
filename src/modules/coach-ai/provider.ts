import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { AiModels } from '@/modules/gym'
import { env } from '@/shared/env'

export type ModelKind = 'main' | 'fast' | 'fallback' | 'templates' | 'exercises'

/** Id модели шаблонов по умолчанию (как указал владелец); в админке можно заменить. */
export const DEFAULT_TEMPLATES_MODEL = 'claude-opus-5.5'

/** Какая настройка зала отвечает за какую задачу. */
const TASK_OF: Record<ModelKind, keyof AiModels> = {
  main: 'chat',
  fast: 'quick',
  fallback: 'fallback',
  templates: 'templates',
  exercises: 'exercises',
}

let overrides: AiModels = {}
let loadedAt = 0
const OVERRIDES_TTL_MS = 30_000

/** Подставляет модели из настроек зала (пустое — значения по умолчанию). */
export function applyModelSettings(models: AiModels | undefined): void {
  overrides = models ?? {}
}

async function loadModelSettings(): Promise<AiModels | undefined> {
  // Динамический импорт: модуль настроек зала сам зависит от coach-ai.
  const { getGym } = await import('@/modules/gym')
  return (await getGym()).settings.aiModels
}

/** Перечитывает модели из настроек зала не чаще раза в 30 секунд; сбой чтения оставляет прежние. */
export async function refreshModelOverrides(
  load: () => Promise<AiModels | undefined> = loadModelSettings,
  now = Date.now(),
): Promise<void> {
  if (now - loadedAt < OVERRIDES_TTL_MS) return
  loadedAt = now

  try {
    applyModelSettings(await load())
  } catch (error) {
    console.error('[ai] не удалось прочитать модели из настроек зала', error)
  }
}

/** ИИ недоступен: обе модели не ответили (ARCHITECTURE.md §9.1). */
export class AiUnavailableError extends Error {
  constructor(message = 'МаксИИм сейчас недоступен', options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AiUnavailableError'
  }
}

const provider = createOpenAICompatible({
  name: 'plusvibe',
  baseURL: env.AI_BASE_URL,
  apiKey: env.AI_API_KEY ?? 'not-configured',
  includeUsage: true,
  // Шлюз принимает `response_format: json_schema`. Без этого флага SDK игнорирует схему,
  // модель отвечает обычным текстом и `generateObject` падает на разборе JSON
  // (черновик упражнения, разбор голосового ввода) — пользователь видит «МаксИИм недоступен».
  supportsStructuredOutputs: true,
})

/** Модель задачи, когда в настройках зала ничего не выбрано. */
export function defaultModelName(kind: ModelKind): string | undefined {
  if (kind === 'templates') return DEFAULT_TEMPLATES_MODEL
  if (kind === 'main' || kind === 'exercises') return env.AI_MODEL_MAIN
  if (kind === 'fast') return env.AI_MODEL_FAST
  return env.AI_MODEL_FALLBACK
}

function modelId(kind: ModelKind): string | undefined {
  return overrides[TASK_OF[kind]] || defaultModelName(kind)
}

/** Задача настроек зала для вида модели. */
export function taskOf(kind: ModelKind): keyof AiModels {
  return TASK_OF[kind]
}

/** Id моделей, которые отдаёт провайдер (`GET {AI_BASE_URL}/models`), по алфавиту. */
export async function listProviderModels(fetchFn: typeof fetch = fetch): Promise<string[]> {
  const response = await fetchFn(`${env.AI_BASE_URL.replace(/\/$/, '')}/models`, {
    headers: { authorization: `Bearer ${env.AI_API_KEY ?? ''}` },
  })
  if (!response.ok) throw new Error(`Провайдер не отдал список моделей (${response.status})`)

  const body = (await response.json()) as { data?: { id?: unknown }[] }
  return (body.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort((a, b) => a.localeCompare(b))
}

/** Проверка модели: вызов на один токен, время ответа или причина ошибки. */
export async function pingModel(
  id: string,
): Promise<{ ok: true; ms: number; text: string } | { ok: false; ms: number; error: string }> {
  const { generateText } = await import('ai')
  const started = Date.now()

  try {
    const result = await withTimeout(
      generateText({ model: provider(id), prompt: 'Ответь одним словом: привет', maxOutputTokens: 8 }),
      20_000,
    )
    return { ok: true, ms: Date.now() - started, text: result.text.trim().slice(0, 80) }
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 200) : 'Модель не ответила',
    }
  }
}

/** Модель AI SDK через OpenAI-совместимый провайдер plusvibeapi. */
export function getModel(kind: ModelKind): LanguageModel {
  const id = modelId(kind)
  if (!id) throw new AiUnavailableError(`Модель ${kind} не настроена`)
  return provider(id)
}

/** Идентификатор модели для логов и учёта расходов. */
export function getModelName(kind: ModelKind): string {
  return modelId(kind) ?? kind
}

export type FallbackDeps = {
  getModel?: (kind: ModelKind) => LanguageModel
  /** Таймаут одного вызова, мс. По умолчанию 30 с. */
  timeoutMs?: number
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Модель не ответила за ${ms} мс`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Вызов модели с таймаутом: основная модель → один повтор на запасной.
 * Если не ответила и запасная — `AiUnavailableError`.
 */
export async function withFallback<T>(
  fn: (model: LanguageModel) => Promise<T>,
  primary: Exclude<ModelKind, 'fallback'>,
  deps: FallbackDeps = {},
): Promise<T> {
  if (!deps.getModel) await refreshModelOverrides()
  const resolve = deps.getModel ?? getModel
  const timeoutMs = deps.timeoutMs ?? 30_000

  try {
    return await withTimeout(fn(resolve(primary)), timeoutMs)
  } catch (primaryError) {
    try {
      return await withTimeout(fn(resolve('fallback')), timeoutMs)
    } catch (fallbackError) {
      // Причину нельзя терять: пользователь видит только «недоступен», а разбираться приходится по логам.
      console.error('[ai] обе модели не ответили', {
        primary: primaryError instanceof Error ? primaryError.message : String(primaryError),
        fallback: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })

      throw new AiUnavailableError('МаксИИм сейчас недоступен', {
        cause: { primary: primaryError, fallback: fallbackError },
      })
    }
  }
}
