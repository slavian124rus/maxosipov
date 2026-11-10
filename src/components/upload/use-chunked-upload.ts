'use client'

import { useCallback, useState } from 'react'

export type UploadKind = 'exercise_video' | 'photo' | 'progress_photo'

export type UploadState = {
  progress: number
  uploading: boolean
  error: string | null
  mediaId: string | null
}

const MAX_ATTEMPTS = 3

/**
 * Кусочная загрузка: 5 МБ на кусок, 3 попытки на кусок,
 * при обрыве продолжает с недостающих частей (статус спрашиваем у сервера).
 */
export function useChunkedUpload() {
  const [state, setState] = useState<UploadState>({
    progress: 0,
    uploading: false,
    error: null,
    mediaId: null,
  })

  const upload = useCallback(async (file: File, kind: UploadKind): Promise<string | null> => {
    setState({ progress: 0, uploading: true, error: null, mediaId: null })

    try {
      const created = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, fileName: file.name, sizeBytes: file.size, mime: file.type }),
      })

      const createdBody = (await created.json()) as {
        id?: string
        chunkSize?: number
        totalChunks?: number
        error?: string
      }

      if (!created.ok || !createdBody.id || !createdBody.chunkSize || !createdBody.totalChunks) {
        throw new Error(createdBody.error ?? 'Не удалось начать загрузку')
      }

      const { id, chunkSize, totalChunks } = createdBody

      // Продолжаем с недостающих кусков, если загрузка уже начиналась.
      const statusResponse = await fetch(`/api/media/${id}`)
      const statusBody = (await statusResponse.json()) as { received_chunks?: number[] }
      const done = new Set(statusBody.received_chunks ?? [])

      let uploadedChunks = done.size

      for (let index = 0; index < totalChunks; index += 1) {
        if (done.has(index)) continue

        const start = index * chunkSize
        const chunk = file.slice(start, Math.min(start + chunkSize, file.size))

        let uploaded = false
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !uploaded; attempt += 1) {
          const response = await fetch(`/api/media/${id}/chunk?index=${index}`, {
            method: 'PUT',
            body: chunk,
          })
          uploaded = response.ok
        }

        if (!uploaded) throw new Error('Загрузка прервалась — попробуй ещё раз')

        uploadedChunks += 1

        setState({
          progress: Math.round((uploadedChunks / totalChunks) * 100),
          uploading: true,
          error: null,
          mediaId: id,
        })
      }

      const completed = await fetch(`/api/media/${id}/complete`, { method: 'POST' })
      const completedBody = (await completed.json()) as { error?: string }
      if (!completed.ok) throw new Error(completedBody.error ?? 'Не удалось завершить загрузку')

      setState({ progress: 100, uploading: false, error: null, mediaId: id })
      return id
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Загрузка не удалась'
      setState({ progress: 0, uploading: false, error: message, mediaId: null })
      return null
    }
  }, [])

  return { ...state, upload }
}
