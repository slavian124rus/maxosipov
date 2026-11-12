import { readFile } from 'node:fs/promises'
import { env } from '@/shared/env'
import type { AudioFile, SpeechToText } from './types'

/**
 * Модель распознавания по умолчанию: `whisper-large-v3` у plusvibeapi.
 * Отдельная настройка нужна только чтобы попробовать другую модель.
 */
export const DEFAULT_STT_MODEL = 'whisper-large-v3'

/**
 * OpenAI-совместимый эндпоинт `POST {AI_BASE_URL}/audio/transcriptions`
 * (по умолчанию `https://plusvibeapi.ru/v1`). Ключ и адрес — те же, что у МаксИИма,
 * поэтому распознавание работает без отдельных переменных окружения.
 */
export class PlusvibeSpeechToText implements SpeechToText {
  async transcribe(file: AudioFile): Promise<string> {
    if (!env.AI_API_KEY) {
      throw new Error('Распознавание речи не настроено: нет AI_API_KEY')
    }

    const model = env.STT_MODEL ?? DEFAULT_STT_MODEL
    const baseUrl = (env.STT_BASE_URL ?? env.AI_BASE_URL).replace(/\/+$/, '')
    const buffer = await readFile(file.path)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mime }), 'voice')
    form.append('model', model)
    form.append('language', 'ru')

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      // Провайдер объясняет отказ в теле ответа: без него 403/404 не отличить
      // «нет доступа к модели» от «такого эндпоинта нет».
      const detail = await response
        .text()
        .then((text) => text.replace(/\s+/g, ' ').trim().slice(0, 300))
        .catch(() => '')

      console.error('[stt] отказ провайдера', { status: response.status, model, baseUrl, detail })

      const hint =
        response.status === 403
          ? ` — у ключа нет доступа к модели «${model}» или эндпоинту распознавания`
          : response.status === 404
            ? ' — такого эндпоинта или модели у провайдера нет'
            : ''

      throw new Error(
        `Распознавание не удалось: ${response.status}${hint}${detail ? `. Ответ: ${detail}` : ''}`,
      )
    }

    const body = (await response.json()) as { text?: string }
    return (body.text ?? '').trim()
  }
}
