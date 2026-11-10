'use client'

import { ArrowRight, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  title: string
  subtitle: string
  cta: string
  ctaHref: string
  videoSrc: string
  poster: string
  badge: string
  scrollHint: string
}

/** `Save-Data` из Network Information API: экономия трафика — только постер. */
function saveDataRequested(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}

/** Свой, а не `useReducedMotion`: значение нужно до первого кадра и без кэша библиотеки. */
function reducedMotionRequested(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Первый экран (DESIGN.md §10.1): `100svh`, фоновое видео с затемнением снизу,
 * заголовок Oswald 56/40, подзаголовок и красная кнопка.
 *
 * Постер — в разметке сразу и грузится первым (это LCP), текст не анимируется:
 * первый экран обязан читаться до загрузки JS (план, Review Focus 1). Ролик
 * добавляется в DOM только после `load`, а на `prefers-reduced-motion` и
 * `Save-Data` не грузится вовсе.
 */
export function Hero({
  title,
  subtitle,
  cta,
  ctaHref,
  videoSrc,
  poster,
  badge,
  scrollHint,
}: Props) {
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    if (reducedMotionRequested() || saveDataRequested()) return

    const start = () => setShowVideo(true)
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })

    return () => window.removeEventListener('load', start)
  }, [])

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-bg"
    >
      {/* Постер героя: единственный обязательный элемент фона. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- статичный WebP из public/, без оптимизатора грузится быстрее */}
      <img
        src={poster}
        alt=""
        width={720}
        height={1280}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />

      {showVideo ? (
        <video
          src={videoSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}

      {/* Затемнение снизу (план, задача 1) и сверху — текст читается на любом кадре. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,.78)_0%,rgba(14,14,16,.25)_26%,rgba(14,14,16,.35)_55%,rgba(14,14,16,.9)_86%,#0e0e10_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(70%_50%_at_18%_100%,rgba(229,50,45,.24),transparent_72%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pt-28 pb-24 sm:px-6 md:pt-32 md:pb-32">
        <div className="flex max-w-[720px] flex-col gap-5">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-muscle-primary/40 bg-muscle-primary/10 px-3 py-1.5 text-[13px] font-semibold text-text">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-muscle-primary motion-safe:animate-pulse"
            />
            {badge}
          </p>

          <h1 className="font-display text-[40px] leading-[0.98] font-medium tracking-[-0.01em] text-balance text-text [text-shadow:0_2px_28px_rgba(0,0,0,.65)] md:text-[56px]">
            {title}
          </h1>

          <p className="text-[15px] leading-relaxed text-text-secondary md:text-[17px]">{subtitle}</p>

          <div className="pt-1">
            <a
              href={ctaHref}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-control bg-accent px-7 text-[19px] font-semibold text-white transition-colors hover:bg-accent-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {cta}
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <a
        href="#inside"
        className="absolute inset-x-0 bottom-5 z-10 mx-auto flex w-fit flex-col items-center gap-1 rounded-control px-3 py-2 text-[13px] text-text-secondary transition-colors hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {scrollHint}
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className="motion-safe:animate-bounce"
        />
      </a>
    </section>
  )
}
