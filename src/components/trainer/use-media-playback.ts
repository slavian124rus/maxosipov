'use client'

import { useEffect, useState } from 'react'
import type { CurrentVideo } from './video-preview'

const POLL_MS = 3000
const WAITING = new Set(['uploaded', 'processing'])

type StatusBody = {
  status?: string
  playback?: { mp4?: string | null; webm?: string | null; poster?: string | null } | null
}

/**
 * Живой статус видео: пока оно в обработке, раз в несколько секунд спрашиваем сервер
 * и сами переключаемся на «готово» или «не обработалось» — без перезагрузки страницы.
 * Новый `mediaId` (только что загрузили файл) сразу считается «обрабатывается».
 */
export function useMediaPlayback(mediaId: string | null, initial: CurrentVideo): CurrentVideo | null {
  const [state, setState] = useState<{ id: string | null; video: CurrentVideo | null }>({
    id: mediaId,
    video: initial.status ? initial : null,
  })

  // Смена mediaId во время рендера: новый файл → сразу «обрабатывается».
  if (state.id !== mediaId) {
    setState({
      id: mediaId,
      video: mediaId ? { status: 'processing', mp4Url: null, webmUrl: null, posterUrl: null } : null,
    })
  }

  const status = state.video?.status ?? null
  const waiting = Boolean(mediaId) && status !== null && WAITING.has(status)

  useEffect(() => {
    if (!mediaId || !waiting) return

    let cancelled = false

    const timer = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/media/${mediaId}`)
          if (!response.ok) return
          const body = (await response.json()) as StatusBody
          if (cancelled || !body.status) return

          setState({
            id: mediaId,
            video: {
              status: body.status,
              mp4Url: body.playback?.mp4 ?? null,
              webmUrl: body.playback?.webm ?? null,
              posterUrl: body.playback?.poster ?? null,
            },
          })
        } catch {
          // Нет сети — попробуем в следующий тик.
        }
      })()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [mediaId, waiting])

  return state.video
}
