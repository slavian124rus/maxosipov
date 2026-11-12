'use client'

import { useState } from 'react'
import { PhotoViewer } from '@/components/ui/photo-viewer'

type Props = {
  /** Полноразмерное фото тренажёра (подписанная ссылка). */
  src: string | null
  /** Название тренажёра — для подписи к фото. */
  machineName: string | null
  name: string
}

/**
 * Фото тренажёра вместо плеера: пока видео нет, карточка не пустая (DESIGN.md §8.2).
 * Никаких кнопок воспроизведения и переключателя «Мышцы» — ролик ещё не снят.
 *
 * В плитке фото обрезано под пропорции (`object-cover`), поэтому касание открывает
 * его целиком — иначе по обрезку не понять, что за тренажёр.
 */
export function ExercisePhoto({ src, machineName, name }: Props) {
  const [open, setOpen] = useState(false)
  const alt = `Тренажёр: ${machineName ?? name}`

  if (!src) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-card bg-surface-2 px-6 text-center">
        <p className="text-[17px] text-text">{name}</p>
        <p className="text-[15px] text-text-secondary">Видео скоро</p>
      </div>
    )
  }

  return (
    <>
      <figure className="relative overflow-hidden rounded-card bg-surface-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть фото тренажёра целиком"
          className="block w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка, оптимизатор Next её не знает */}
          <img src={src} alt={alt} className="aspect-[3/4] w-full object-cover" />
        </button>

        <figcaption className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] text-white">
            Видео скоро
          </span>
        </figcaption>

        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/55 px-3 py-1 text-[12px] text-white">
          Нажми, чтобы рассмотреть
        </span>
      </figure>

      <PhotoViewer src={src} alt={alt} open={open} onOpenChange={setOpen} />
    </>
  )
}
