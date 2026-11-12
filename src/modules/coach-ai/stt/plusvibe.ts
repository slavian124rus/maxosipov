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
    const buffer = await readFile(file.path)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mime }), 'voice')
    form.append('model', model)
    form.append('language', 'ru')

    const response = await fetch(`${env.AI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      throw new Error(`Распознавание не удалось: ${response.status} (${model})`)
    }

    const body = (await response.json()) as { text?: string }
    return (body.text ?? '').trim()
  }
}
