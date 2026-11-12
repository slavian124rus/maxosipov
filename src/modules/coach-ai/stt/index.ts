import { env } from '@/shared/env'
import { DEFAULT_STT_MODEL, PlusvibeSpeechToText } from './plusvibe'
import type { SpeechToText } from './types'
import { YandexSpeechToText } from './yandex'

export type { AudioFile, SpeechToText } from './types'
export { DEFAULT_STT_MODEL, PlusvibeSpeechToText } from './plusvibe'
export { YandexSpeechToText } from './yandex'

/** Провайдер по умолчанию: тот же plusvibeapi, что и у МаксИИма. */
export const DEFAULT_STT_PROVIDER = 'plusvibe'

/**
 * Провайдер распознавания (ARCHITECTURE.md §9.7).
 *
 * По умолчанию — plusvibe с моделью `whisper-large-v3` на ключе и адресе МаксИИма,
 * поэтому распознавание работает без `STT_PROVIDER`/`STT_MODEL` в окружении.
 * Yandex включается явно (`STT_PROVIDER=yandex`) и требует свой ключ.
 */
export function getSpeechToText(): SpeechToText {
  if (env.STT_PROVIDER === 'yandex') return new YandexSpeechToText()
  return new PlusvibeSpeechToText()
}

/** Какая модель пойдёт в запрос — для логов и подсказок в интерфейсе. */
export function speechModelName(): string {
  return env.STT_PROVIDER === 'yandex' ? 'yandex-speechkit' : (env.STT_MODEL ?? DEFAULT_STT_MODEL)
}
