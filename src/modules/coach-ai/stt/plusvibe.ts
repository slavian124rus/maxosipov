import { readFile } from 'node:fs/promises'
import { env } from '@/shared/env'
import type { AudioFile, SpeechToText } from './types'

/**
 * OpenAI-совместимый эндпоинт `POST {AI_BASE_URL}/audio/transcriptions`.
 * Проверка наличия эндпоинта и модели у plusvibeapi — в `docs/ops/stt.md`.
 */
export class PlusvibeSpeechToText implements SpeechToText {
  async transcribe(file: AudioFile): Promise<string> {
    if (!env.AI_API_KEY || !env.STT_MODEL) {
      throw new Error('Распознавание речи не настроено: нет AI_API_KEY или STT_MODEL')
    }

    const buffer = await readFile(file.path)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mime }), 'voice')
    form.append('model', env.STT_MODEL)
    form.append('language', 'ru')

    const response = await fetch(`${env.AI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      throw new Error(`Распознавание не удалось: ${response.status}`)
    }

    const body = (await response.json()) as { text?: string }
    return (body.text ?? '').trim()
  }
}