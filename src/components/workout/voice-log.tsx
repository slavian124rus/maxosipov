'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VoiceRow } from '@/modules/coach-ai'

type Option = { id: string; name: string }

type EditableRow = VoiceRow & { skipped: boolean }

type Props = {
  sessionClientUuid: string
  exercises: Option[]
  /** Сохранить проверенные строки (подходы + ощущение). */
  onSave: (rows: VoiceRow[]) => Promise<void>
  label?: string
  /** Иконка-микрофон в шапке тренировки. */
  compact?: boolean
}

const MAX_MS = 120_000
const FEELINGS: { value: 'easy' | 'good' | 'hard'; label: string }[] = [
  { value: 'easy', label: 'Легко' },
  { value: 'good', label: 'Отлично' },
  { value: 'hard', label: 'Тяжело' },
]

/** Голосовой ввод подходов: запись → «Проверь» → сохранить (DESIGN.md §8.5). */
export function VoiceLog({
  sessionClientUuid,
  exercises,
  onSave,
  label = 'Наговорить, что сделал',
  compact = false,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'review' | 'saving'>('idle')
  const [level, setLevel] = useState(0)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      void audioContextRef.current?.close()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function stopTracks(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    void audioContextRef.current?.close()
    audioContextRef.current = null
    streamRef.current = null
    setLevel(0)
  }

  async function start(): Promise<void> {
    setError(null)
    setReply(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      audioContext.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = (): void => {
        if (!audioContextRef.current) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const value of data) sum += (value - 128) ** 2
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40))
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)

      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onstop = () => {
        stopTracks()
        if (timerRef.current) clearTimeout(timerRef.current)
        void upload(new Blob(chunks, { type: mime }), mime)
      }

      recorder.start()
      recorderRef.current = recorder
      setPhase('recording')
      timerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, MAX_MS)
    } catch {
      setError('Нет доступа к микрофону')
      setPhase('idle')
    }
  }
async function upload(blob: Blob, mime: string): Promise<void> {
    setPhase('processing')

    const form = new FormData()
    form.append('audio', blob, mime === 'audio/mp4' ? 'voice.mp4' : 'voice.webm')
    form.append('sessionClientUuid', sessionClientUuid)

    try {
      const response = await fetch('/api/coach/voice', { method: 'POST', body: form })
      const body = (await response.json().catch(() => null)) as
        | { text?: string; rows?: VoiceRow[]; reply?: string | null; error?: string }
        | null

      if (!response.ok) {
        setError(body?.error ?? 'Не удалось распознать')
        setPhase('idle')
        return
      }

      setReply(body?.reply ?? null)
      setRows((body?.rows ?? []).map((row) => ({ ...row, skipped: false })))
      setPhase('review')
    } catch {
      setError('Не удалось распознать')
      setPhase('idle')
    }
  }

  function updateRow(index: number, patch: Partial<EditableRow>): void {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    )
  }

  function updateSet(
    rowIndex: number,
    setIndex: number,
    patch: Partial<{ weightKg: number; reps: number }>,
  ): void {
    setRows((current) =>
      current.map((row, position) =>
        position === rowIndex
          ? {
              ...row,
              sets: row.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
            }
          : row,
      ),
    )
  }

  async function save(): Promise<void> {
    const clean = rows
      .filter((row) => !row.skipped && row.exerciseId && row.sets.length > 0)
      .map((row) => ({
        exerciseId: row.exerciseId,
        spokenName: row.spokenName,
        sets: row.sets,
        feeling: row.feeling,
      }))

    if (clean.length === 0) {
      setError('Нечего сохранять')
      return
    }

    setPhase('saving')
    try {
      await onSave(clean)
      setRows([])
      setPhase('idle')
    } catch {
      setError('Не удалось сохранить')
      setPhase('review')
    }
  }
if (phase === 'idle' || phase === 'recording') {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          className={compact ? 'h-12 w-12 p-0' : undefined}
          aria-label={phase === 'recording' ? 'Остановить запись' : label}
          onClick={() => {
            if (phase === 'recording') recorderRef.current?.stop()
            else void start()
          }}
        >
          {phase === 'recording' ? <Square size={18} /> : <Mic size={compact ? 20 : 18} />}
          {compact ? null : phase === 'recording' ? 'Остановить запись' : label}
        </Button>

        {phase === 'recording' ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <h2 className="text-[22px] font-semibold">Проверь</h2>

        {phase === 'processing' ? (
          <p className="text-[15px] text-text-secondary">Распознаём…</p>
        ) : null}

        {reply ? (
          <p className="rounded-card border border-danger/40 px-3 py-2 text-[15px] text-danger">
            {reply}
          </p>
        ) : null}

        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-semibold">{row.spokenName || 'Упражнение'}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateRow(rowIndex, { skipped: !row.skipped })}
              >
                {row.skipped ? 'Вернуть' : 'Пропустить'}
              </Button>
            </div>

            {row.exerciseId ? null : (
              <div className="flex flex-col gap-1">
                <p className="text-[13px] text-warning">Не нашёл в тренировке</p>
                <select
                  value={row.exerciseId ?? ''}
                  onChange={(event) => updateRow(rowIndex, { exerciseId: event.target.value || null })}
                  className="h-10 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
                >
                  <option value="">Пропустить</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {row.skipped ? null : (
              <>
                {row.sets.map((set, setIndex) => (
                  <div key={setIndex} className="flex items-center gap-2">
                    <span className="text-[13px] text-text-muted">Подход {setIndex + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weightKg}
                      aria-label={`Вес, подход ${setIndex + 1}`}
                      onChange={(event) =>
                        updateSet(rowIndex, setIndex, { weightKg: Number(event.target.value) })
                      }
                      className="h-10 w-20 rounded-control border border-border bg-bg px-2 text-[15px]"
                    />
                    <span className="text-[13px] text-text-muted">кг</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={set.reps}
                      aria-label={`Повторения, подход ${setIndex + 1}`}
                      onChange={(event) =>
                        updateSet(rowIndex, setIndex, { reps: Number(event.target.value) })
                      }
                      className="h-10 w-16 rounded-control border border-border bg-bg px-2 text-[15px]"
                    />
                    <span className="text-[13px] text-text-muted">раз</span>
                  </div>
                ))}

                <div className="flex gap-2">
                  {FEELINGS.map((feeling) => (
                    <button
                      key={feeling.value}
                      type="button"
                      onClick={() =>
                        updateRow(rowIndex, {
                          feeling: row.feeling === feeling.value ? null : feeling.value,
                        })
                      }
                      className={`rounded-full px-3 py-1 text-[13px] ${
                        row.feeling === feeling.value
                          ? 'bg-accent text-white'
                          : 'border border-border text-text-secondary'
                      }`}
                    >
                      {feeling.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>

      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setPhase('idle')}>
          Отмена
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={phase !== 'review'}
          onClick={() => void save()}
        >
          {phase === 'saving' ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </div>
  )
}