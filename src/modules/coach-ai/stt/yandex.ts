import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runProcess } from '@/modules/media'
import { env } from '@/shared/env'
import type { AudioFile, SpeechToText } from './types'

const SPEECHKIT_URL = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize'
const SEGMENT_SECONDS = 25

function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || 'ffmpeg'
}

/**
 * Yandex SpeechKit, синхронное распознавание (ограничение ~30 с на запрос):
 * аудио режется ffmpeg на куски по 25 с и перекодируется в ogg/opus, тексты склеиваются.
 */
export class YandexSpeechToText implements SpeechToText {
  async transcribe(file: AudioFile): Promise<string> {
    if (!env.YANDEX_SPEECHKIT_KEY) {
      throw new Error('Распознавание речи не настроено: нет YANDEX_SPEECHKIT_KEY')
    }

    const dir = await mkdtemp(path.join(tmpdir(), 'stt-'))

    try {
      await runProcess(
        ffmpegPath(),
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          file.path,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '48000',
          '-c:a',
          'libopus',
          '-b:a',
          '48k',
          '-f',
          'segment',
          '-segment_time',
          String(SEGMENT_SECONDS),
          path.join(dir, 'part-%03d.ogg'),
        ],
        120_000,
      )

      const parts = (await readdir(dir)).filter((name) => name.endsWith('.ogg')).sort()
      const texts: string[] = []

      for (const part of parts) {
        const audio = await readFile(path.join(dir, part))
        const url = `${SPEECHKIT_URL}?lang=ru-RU&topic=general`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Api-Key ${env.YANDEX_SPEECHKIT_KEY}`,
            'Content-Type': 'audio/ogg',
          },
          body: new Uint8Array(audio),
        })

        if (!response.ok) {
          throw new Error(`SpeechKit не распознал: ${response.status}`)
        }

        const body = (await response.json()) as { result?: string }
        if (body.result) texts.push(body.result.trim())
      }

      return texts.join(' ').trim()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}