'use client'

import { useEffect, useState } from 'react'

/** Ползунок «Где ты в кадре» для горизонтального видео (cropX 0..1). */
export function VideoCrop({ file, value, onChange }: { file: File | null; value: number; onChange: (value: number) => void }) {
  const [landscape, setLandscape] = useState(false)

  useEffect(() => {
    if (!file) return

    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      // setState в колбэке внешнего события — так правило и требует.
      setLandscape(video.videoWidth > video.videoHeight)
      URL.revokeObjectURL(url)
    }

    video.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!file || !landscape) return null

  return (
    <label className="flex flex-col gap-2 text-[13px] text-text-secondary">
      Где ты в кадре
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="accent-accent"
      />
    </label>
  )
}
