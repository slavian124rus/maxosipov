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
    return (
      <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-text-secondary">
        Видео обрабатывается. Пока в карточке показывается фото тренажёра; обычно это занимает пару минут.
      </p>
    )
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
