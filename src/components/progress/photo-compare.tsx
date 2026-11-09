'use client'

import { useMemo, useState } from 'react'
import type { PhotoView } from './photos-client'

const POSE_LABEL: Record<PhotoView['pose'], string> = {
  front: 'Спереди',
  side: 'Сбоку',
  back: 'Сзади',
}

type Props = { photos: PhotoView[] }

/** Сравнение «до/после»: две даты одной позы рядом. */
export function PhotoCompare({ photos }: Props) {
  const ready = useMemo(() => photos.filter((photo) => photo.status === 'ready' && photo.photoUrl), [photos])

  const [pose, setPose] = useState<PhotoView['pose']>('front')
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)
  const [brokenId, setBrokenId] = useState<string | null>(null)

  const samePose = ready.filter((photo) => photo.pose === pose)
  const before = samePose.find((photo) => photo.id === beforeId) ?? samePose[0]
  const after = samePose.find((photo) => photo.id === afterId) ?? samePose.at(-1)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['front', 'side', 'back'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setPose(value)
              setBeforeId(null)
              setAfterId(null)
            }}
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

      {samePose.length < 2 ? (
        <p className="text-[15px] text-text-secondary">Нужно минимум два снимка в одной позе</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'before', photo: before, title: 'До' },
            { key: 'after', photo: after, title: 'После' },
          ].map(({ key, photo, title }) => (
            <div key={key} className="flex flex-col gap-2">
              <span className="text-[13px] text-text-muted">{title}</span>

              {photo?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка
                <img
                  src={photo.photoUrl}
                  alt={`${title}: ${photo.date}`}
                  onError={() => setBrokenId(photo.id)}
                  className="aspect-[3/4] w-full rounded-card object-cover"
                />
              ) : (
                <div className="aspect-[3/4] w-full rounded-card bg-surface-2" />
              )}

              {photo && brokenId === photo.id ? (
                <span className="text-[11px] text-warning">Ссылка устарела. Обнови страницу</span>
              ) : null}

              <div className="flex gap-1 overflow-x-auto">
                {samePose.map((item) => {
                  const selected = key === 'before' ? item.id === before?.id : item.id === after?.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (key === 'before' ? setBeforeId(item.id) : setAfterId(item.id))}
                      className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${
                        selected
                          ? 'border-accent bg-surface-2 text-text'
                          : 'border-border bg-surface-1 text-text-muted'
                      }`}
                    >
                      {item.date}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}