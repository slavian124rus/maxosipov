'use client'

import { MapPin } from 'lucide-react'
import { useState } from 'react'

type Props = {
  /** Проверенный адрес виджета Яндекс Карт (`safeMapEmbedUrl`). */
  src: string
  title: string
  address: string
  showLabel: string
  note: string
}

/**
 * Карта грузится только после нажатия: до этого Яндекс не получает ни запроса, ни данных
 * посетителя (быстрее страница и спокойнее с 152-ФЗ). До нажатия — стилизованная заглушка.
 */
export function MapEmbed({ src, title, address, showLabel, note }: Props) {
  const [loaded, setLoaded] = useState(false)

  if (loaded) {
    return (
      <iframe
        src={src}
        title={title}
        className="size-full min-h-[320px] rounded-card border border-border bg-surface-1"
        style={{ border: 0 }}
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="group relative flex size-full min-h-[320px] flex-col items-center justify-center gap-3 overflow-hidden rounded-card border border-border bg-surface-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,#202024_1px,transparent_1px),linear-gradient(to_bottom,#202024_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(to_right,#2a2a2f_3px,transparent_3px),linear-gradient(to_bottom,#2a2a2f_3px,transparent_3px)] [background-size:176px_176px]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(45%_45%_at_50%_45%,rgba(229,50,45,.24),transparent_70%)]"
      />

      <span className="relative flex flex-col items-center gap-3 px-6 text-center">
        <span className="grid size-14 place-items-center rounded-full border border-muscle-primary/50 bg-bg/80 motion-safe:animate-pulse">
          <MapPin size={24} strokeWidth={1.75} aria-hidden="true" className="text-muscle-primary" />
        </span>
        <span className="text-[15px] leading-snug text-text-secondary">{address}</span>
        <span className="inline-flex h-12 items-center justify-center rounded-control bg-accent px-6 text-[16px] font-bold text-white transition-colors group-hover:bg-accent-pressed">
          {showLabel}
        </span>
        <span className="text-[12px] text-text-muted">{note}</span>
      </span>
    </button>
  )
}
