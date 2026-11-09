import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { env } from '@/shared/env'

export type ModelKind = 'main' | 'fast' | 'fallback'

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
})

function modelId(kind: ModelKind): string | undefined {
  if (kind === 'main') return env.AI_MODEL_MAIN
  if (kind === 'fast') return env.AI_MODEL_FAST
  return env.AI_MODEL_FALLBACK
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
  primary: 'main' | 'fast',
  deps: FallbackDeps = {},
): Promise<T> {
  const resolve = deps.getModel ?? getModel
  const timeoutMs = deps.timeoutMs ?? 30_000

  try {
    return await withTimeout(fn(resolve(primary)), timeoutMs)
  } catch (primaryError) {
    try {
      return await withTimeout(fn(resolve('fallback')), timeoutMs)
    } catch (fallbackError) {
      throw new AiUnavailableError('МаксИИм сейчас недоступен', {
        cause: { primary: primaryError, fallback: fallbackError },
      })
    }
  }
}
