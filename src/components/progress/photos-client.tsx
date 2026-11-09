'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useChunkedUpload } from '@/components/upload/use-chunked-upload'
import {
  addProgressPhotoAction,
  deleteProgressPhotoAction,
  type PhotoState,
} from '@/app/(app)/app/(client)/progress/photos/actions'

const INITIAL: PhotoState = { error: null, saved: false }

export type PhotoView = {
  id: string
  date: string
  pose: 'front' | 'side' | 'back'
  status: 'processing' | 'ready' | 'failed'
  photoUrl: string | null
  thumbUrl: string | null
}

const POSE_LABEL: Record<PhotoView['pose'], string> = {
  front: 'Спереди',
  side: 'Сбоку',
  back: 'Сзади',
}

/** Сетка фото, загрузчик и статусы обработки. */
export function PhotosClient({ photos, canWrite }: { photos: PhotoView[]; canWrite: boolean }) {
  const router = useRouter()
  const upload = useChunkedUpload()
  const [state, formAction, pending] = useActionState(addProgressPhotoAction, INITIAL)
  const [mediaId, setMediaId] = useState<string | null>(null)
  const [pose, setPose] = useState<PhotoView['pose']>('front')
  const [opened, setOpened] = useState<PhotoView | null>(null)

  const hasProcessing = photos.some((photo) => photo.status === 'processing')

  useEffect(() => {
    if (!hasProcessing) return

    // Пока есть фото в обработке — обновляем страницу раз в 5 секунд (не дольше 2 минут).
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (attempts > 24) {
        clearInterval(timer)
        return
      }
      router.refresh()
    }, 5000)

    return () => clearInterval(timer)
  }, [hasProcessing, router])

  async function uploadPhoto(file: File): Promise<void> {
    const id = await upload.upload(file, 'progress_photo')
    if (id) setMediaId(id)
  }

  return (
    <div className="flex flex-col gap-5">
      {canWrite ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
          <p className="text-[17px]">Добавить фото</p>
          <p className="text-[13px] text-text-muted">
            Снимай при одинаковом свете и в одной позе — так сравнение честнее
          </p>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadPhoto(file)
            }}
            className="text-[15px] text-text-secondary"
          />

          {upload.uploading ? (
            <p className="text-[15px] text-text-secondary">Загружаем… {upload.progress}%</p>
          ) : null}
          {upload.error ? <p className="text-[15px] text-danger">{upload.error}</p> : null}

          <div className="flex flex-col gap-2">
            <Label>Поза</Label>
            <div className="flex gap-2">
              {(['front', 'side', 'back'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPose(value)}
                  className={`h-12 flex-1 rounded-control border text-[15px] ${
                    pose === value
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {POSE_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="mediaId" value={mediaId ?? ''} />
            <input type="hidden" name="pose" value={pose} />
            {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
            {state.saved ? <p className="text-[15px] text-success">Фото добавлено</p> : null}
            <Button type="submit" disabled={!mediaId || pending}>
              {pending ? 'Сохраняем…' : 'Добавить фото'}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="flex flex-col gap-1">
            {photo.status === 'ready' && photo.thumbUrl ? (
              <button type="button" onClick={() => setOpened(photo)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка */}
                <img
                  src={photo.thumbUrl}
                  alt={`${photo.date} · ${POSE_LABEL[photo.pose]}`}
                  className="aspect-[3/4] w-full rounded-card object-cover"
                />
              </button>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center rounded-card bg-surface-2 px-1 text-center text-[11px] text-text-muted">
                {photo.status === 'failed'
                  ? 'Не получилось обработать. Загрузи ещё раз'
                  : 'Обрабатывается…'}
              </div>
            )}

            <span className="text-[11px] text-text-muted">
              {photo.date} · {POSE_LABEL[photo.pose]}
            </span>

            {canWrite ? (
              <form action={deleteProgressPhotoAction}>
                <input type="hidden" name="id" value={photo.id} />
                <button
                  type="submit"
                  className="text-[11px] text-danger"
                  onClick={(event) => {
                    if (!window.confirm(`Удалить фото от ${photo.date}?`)) event.preventDefault()
                  }}
                >
                  Удалить
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </section>

      {photos.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Фото пока нет</p>
      ) : null}

      {opened?.photoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpened(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка */}
          <img src={opened.photoUrl} alt="" className="max-h-full w-full object-contain" />
        </div>
      ) : null}
    </div>
  )
}
