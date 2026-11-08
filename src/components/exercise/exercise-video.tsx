'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  mp4: string | null
  webm: string | null
  musclesMp4: string | null
  poster: string | null
  name: string
}

const STORAGE_KEY = 'muscles-on'

/** Видео упражнения с переключателем «Мышцы»: два синхронных ролика (DESIGN.md §8.2). */
export function ExerciseVideo({ mp4, webm, musclesMp4, poster, name }: Props) {
  const [musclesOn, setMusclesOn] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [offline, setOffline] = useState(false)
  const plainRef = useRef<HTMLVideoElement>(null)
  const musclesRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- значение читаем из localStorage только после монтирования
    if (saved !== null) setMusclesOn(saved === '1')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, musclesOn ? '1' : '0')

    const muscles = musclesRef.current
    if (!muscles || !musclesOn) return

    const plain = plainRef.current
    if (plain && Math.abs(muscles.currentTime - plain.currentTime) > 0.06) {
      muscles.currentTime = plain.currentTime
    }
    void muscles.play().catch(() => {})
  }, [musclesOn])

  function togglePlay(): void {
    const videos = [plainRef.current, musclesRef.current].filter(Boolean) as HTMLVideoElement[]
    for (const video of videos) {
      if (video.paused) void video.play()
      else video.pause()
    }
    setPlaying((value) => !value)
  }

  if (!mp4 && !webm) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-card bg-surface-1 px-4 text-center text-[15px] text-text-secondary">
        Видео загрузится, когда появится связь
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-card bg-black">
      <video
        ref={plainRef}
        className="aspect-[9/16] w-full object-cover"
        poster={poster ?? undefined}
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
        onClick={togglePlay}
        onError={() => setOffline(true)}
        aria-label={`Видео: ${name}`}
      >
        {webm ? <source src={webm} type="video/webm" /> : null}
        {mp4 ? <source src={mp4} type="video/mp4" /> : null}
      </video>

      {musclesMp4 ? (
        <video
          ref={musclesRef}
          className={`pointer-events-none absolute inset-0 aspect-[9/16] w-full object-cover transition-opacity duration-[450ms] ${
            musclesOn ? 'opacity-100' : 'opacity-0'
          }`}
          poster={poster ?? undefined}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          aria-hidden={!musclesOn}
        >
          <source src={musclesMp4} type="video/mp4" />
        </video>
      ) : null}

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] text-white">
          Показывает Максим
        </span>
        {musclesMp4 ? (
          <button
            type="button"
            onClick={() => setMusclesOn((value) => !value)}
            aria-pressed={musclesOn}
            className={`rounded-full px-3 py-1 text-[13px] ${
              musclesOn ? 'bg-accent text-white' : 'bg-black/55 text-white'
            }`}
          >
            Мышцы
          </button>
        ) : null}
      </div>

      {!playing ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 px-4 py-2 text-[15px] text-white">Пауза</span>
        </div>
      ) : null}

      {offline ? (
        <p className="absolute inset-x-3 bottom-3 rounded-control bg-black/70 px-3 py-2 text-[13px] text-white">
          Видео загрузится, когда появится связь
        </p>
      ) : null}
    </div>
  )
}
