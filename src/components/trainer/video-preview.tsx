'use client'

import { useEffect, useState } from 'react'

export type CurrentVideo = {
  /** Статус обработки на сервере; `null` — видео нет. */
  status: string | null
  mp4Url: string | null
  webmUrl: string | null
  posterUrl: string | null
}

/**
 * Предпросмотр видео в окне правки: только что выбранный файл (до отправки)
 * или уже загруженное видео. Вертикальный кадр, как у клиента на тренировке.
 */
export function VideoPreview({ file, current }: { file: File | null; current: CurrentVideo | null }) {
  const [localUrl, setLocalUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return

    const url = URL.createObjectURL(file)
    // Адрес появляется только после монтирования: на сервере objectURL не существует.
    const timer = setTimeout(() => setLocalUrl(url), 0)

    return () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      setLocalUrl(null)
    }
  }, [file])

  if (file && localUrl) {
    return (
      <Frame caption="Так видео выглядит до отправки. После загрузки оно обработается заново">
        <video src={localUrl} controls playsInline muted preload="metadata" className="h-full w-full object-contain" />
      </Frame>
    )
  }

  if (!current || !current.status) return null

  if (current.status === 'processing') {
    return <VideoProcessing />
  }

  if (current.status !== 'ready' || !current.mp4Url) {
    return (
      <p className="rounded-card border border-danger/40 px-4 py-3 text-[15px] text-danger">
        Видео не обработалось: загрузи его ещё раз.
      </p>
    )
  }

  return (
    <Frame caption="Загруженное видео: так его увидит клиент">
      <video
        controls
        playsInline
        muted
        preload="metadata"
        poster={current.posterUrl ?? undefined}
        className="h-full w-full object-contain"
      >
        <source src={current.mp4Url} type="video/mp4" />
        {current.webmUrl ? <source src={current.webmUrl} type="video/webm" /> : null}
      </video>
    </Frame>
  )
}

function Frame({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="mx-auto aspect-[9/16] max-h-[55dvh] w-full max-w-[320px] overflow-hidden rounded-card border border-border bg-black">
        {children}
      </div>
      <figcaption className="text-center text-[13px] text-text-muted">{caption}</figcaption>
    </figure>
  )
}

/** Видео сжимается на сервере: крутилка и бегущий блик вместо сухой строки. */
export function VideoProcessing() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center gap-4 overflow-hidden rounded-card border border-border bg-surface-1 p-4"
    >
      <div
        data-loader
        aria-hidden="true"
        className="size-11 shrink-0 animate-spin rounded-full border-[3px] border-border border-t-accent"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[17px] font-medium text-text">Видео обрабатывается</p>
        <p className="text-[14px] text-text-secondary">
          Обычно пара минут. Пока в карточке — фото тренажёра.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-[video-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />
    </div>
  )
}
