import { env } from '@/shared/env'
import { PlusvibeSpeechToText } from './plusvibe'
import type { SpeechToText } from './types'
import { YandexSpeechToText } from './yandex'

export type { AudioFile, SpeechToText } from './types'
export { PlusvibeSpeechToText } from './plusvibe'
export { YandexSpeechToText } from './yandex'

/** Провайдер распознавания из `STT_PROVIDER` (ARCHITECTURE.md §9.7). */
export function getSpeechToText(): SpeechToText {
  if (env.STT_PROVIDER === 'yandex') return new YandexSpeechToText()
  if (env.STT_PROVIDER === 'plusvibe') return new PlusvibeSpeechToText()
  throw new Error('Распознавание речи не настроено: укажи STT_PROVIDER')
}
