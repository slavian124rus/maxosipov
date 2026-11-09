export type AudioFile = { path: string; mime: string }

/** Распознавание речи: plusvibeapi Whisper-класса или Yandex SpeechKit. */
export interface SpeechToText {
  transcribe(file: AudioFile): Promise<string>
}