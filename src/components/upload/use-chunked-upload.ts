'use client'

import { useCallback, useState } from 'react'

export type UploadKind = 'exercise_video' | 'machine_photo' | 'photo' | 'progress_photo'

export type UploadState = {
  progress: number
  uploading: boolean
  error: string | null
  mediaId: string | null
}

const MAX_ATTEMPTS = 3
const NETWORK_ERROR = 'Нет связи с сервером. Проверь интернет и попробуй ещё раз'

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Запрос с повтором при обрыве сети («Failed to fetch»): после сворачивания приложения
 * или камеры соединение часто «протухшее», со второй попытки оно проходит.
 */
async function fetchRetry(input: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      await pause(800 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(NETWORK_ERROR)
}

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
      const created = await fetchRetry('/api/media', {
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
      const statusResponse = await fetchRetry(`/api/media/${id}`)
      const statusBody = (await statusResponse.json()) as { received_chunks?: number[] }
      const done = new Set(statusBody.received_chunks ?? [])

      let uploadedChunks = done.size

      for (let index = 0; index < totalChunks; index += 1) {
        if (done.has(index)) continue

        const start = index * chunkSize
        const chunk = file.slice(start, Math.min(start + chunkSize, file.size))

        let uploaded = false
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !uploaded; attempt += 1) {
          try {
            const response = await fetch(`/api/media/${id}/chunk?index=${index}`, {
              method: 'PUT',
              body: chunk,
            })
            uploaded = response.ok
          } catch {
            // Обрыв сети: подождём и повторим этот же кусок.
          }
          if (!uploaded) await pause(800 * (attempt + 1))
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

      const completed = await fetchRetry(`/api/media/${id}/complete`, { method: 'POST' })
      const completedBody = (await completed.json()) as { error?: string }
      if (!completed.ok) throw new Error(completedBody.error ?? 'Не удалось завершить загрузку')

      setState({ progress: 100, uploading: false, error: null, mediaId: id })
      return id
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Загрузка не удалась'
      const message = error instanceof TypeError ? NETWORK_ERROR : raw
      setState({ progress: 0, uploading: false, error: message, mediaId: null })
      return null
    }
  }, [])

  return { ...state, upload }
}
