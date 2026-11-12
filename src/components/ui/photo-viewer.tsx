'use client'

import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/**
 * Просмотр фото целиком (DESIGN.md §8.2).
 *
 * Фото тренажёра в карточке обрезано под пропорции плитки (`object-cover`), и по нему
 * нельзя понять, что за тренажёр. Касание открывает его целиком: `object-contain` на
 * тёмном фоне, без обрезки, закрытие — касанием по фото, крестиком или Escape.
 */
export function PhotoViewer({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string | null
  alt: string
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[94dvh] w-full max-w-[calc(100%-1.5rem)] grid-cols-[minmax(0,1fr)] flex-col gap-2 bg-bg p-2 sm:max-w-[min(94vw,900px)]"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <DialogTitle className="truncate text-[15px] text-text">{alt}</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть фото"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:text-text"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {src ? (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть фото"
            className="block min-h-0 flex-1 overflow-hidden rounded-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка */}
            <img
              src={src}
              alt={alt}
              className="mx-auto max-h-[80dvh] w-auto max-w-full object-contain"
            />
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
