'use client'

import { ArrowRight, ChevronDown } from 'lucide-react'
import { useEffect, useRef } from 'react'

type Props = {
  title: string
  accent: string
  subtitle: string
  cta: string
  ctaSecondary: string
  ctaHref: string
  imageWide: string
  imageMobile: string
  imageAlt: string
  badge: string
  scrollHint: string
  stats: readonly { value: string; label: string }[]
}

/** Свой, а не `useReducedMotion`: значение нужно до первого кадра и без кэша библиотеки. */
function reducedMotionRequested(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Заголовок с акцентной частью: «Тренер рядом [на каждом подходе]». */
function renderTitle(title: string, accent: string) {
  const index = accent ? title.indexOf(accent) : -1
  if (index === -1) return title

  return (
    <>
      {title.slice(0, index)}
      <span className="relative whitespace-nowrap text-accent">
        {accent}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-1 h-[3px] origin-left rounded-full bg-accent/70 motion-safe:animate-[underline-grow_0.9s_0.4s_ease-out_both]"
        />
      </span>
      {title.slice(index + accent.length)}
    </>
  )
}

/**
 * Первый экран: фото Максима в зале на всю высоту, слева — заголовок, подзаголовок,
 * две кнопки и три факта. На телефоне кадр портретный (Максим по центру), на десктопе —
 * широкий, прижат вправо и растворяется в фоне под текстом.
 *
 * Постер грузится первым (это LCP), текст не анимируется: экран обязан читаться до JS.
 * Фото чуть смещается при прокрутке (параллакс); при `prefers-reduced-motion` стоит на месте.
 */
export function Hero({
  title,
  accent,
  subtitle,
  cta,
  ctaSecondary,
  ctaHref,
  imageWide,
  imageMobile,
  imageAlt,
  badge,
  scrollHint,
  stats,
}: Props) {
  const photoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotionRequested()) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, window.innerHeight)
        if (photoRef.current) photoRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(1.04)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <section id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-bg max-lg:min-h-[max(100svh,910px)]">
      <div
        ref={photoRef}
        className="absolute inset-y-0 right-0 w-full will-change-transform lg:w-[74%] lg:[mask-image:linear-gradient(to_right,transparent_0%,#000_34%)]"
      >
        <picture>
          <source media="(min-width: 1024px)" srcSet={imageWide} />
          <img
            src={imageMobile}
            alt={imageAlt}
            width={720}
            height={1280}
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover object-[50%_0%] lg:object-[50%_30%]"
          />
        </picture>
      </div>

      {/* Затемнение: сверху — под шапку, снизу — под текст; красное свечение — фирменный акцент. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,.82)_0%,rgba(14,14,16,.05)_20%,rgba(14,14,16,.35)_38%,rgba(14,14,16,.9)_58%,#0e0e10_80%)] lg:bg-[linear-gradient(180deg,rgba(14,14,16,.7)_0%,rgba(14,14,16,0)_22%,rgba(14,14,16,0)_70%,#0e0e10_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_45%_at_12%_100%,rgba(229,50,45,.3),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-end px-4 pt-28 pb-24 sm:px-6 lg:justify-center lg:pt-24 lg:pb-28">
        <div className="flex max-w-[620px] flex-col gap-5 lg:max-w-[640px]">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-muscle-primary/40 bg-bg/60 px-3.5 py-1.5 text-[13px] font-semibold text-text backdrop-blur-sm">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-muscle-primary motion-safe:animate-pulse"
            />
            {badge}
          </p>

          <h1 className="font-display text-[clamp(30px,11vw,44px)] leading-[1] font-medium tracking-[-0.01em] text-balance text-text [text-shadow:0_2px_28px_rgba(0,0,0,.6)] sm:text-[56px] lg:text-[76px] lg:leading-[0.98]">
            {renderTitle(title, accent)}
          </h1>

          <p className="max-w-[540px] rounded-card border border-text/15 bg-bg/70 px-4 py-3 text-[16px] leading-relaxed text-text shadow-[0_8px_32px_-12px_rgba(0,0,0,.7)] backdrop-blur-lg md:text-[18px]">
            {subtitle}
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <a
              href={ctaHref}
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-control bg-accent px-5 text-[17px] font-bold sm:px-7 sm:text-[19px] text-white transition-colors hover:bg-accent-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {cta}
              <ArrowRight
                size={20}
                strokeWidth={1.75}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
            <a
              href="#inside"
              className="inline-flex h-14 items-center justify-center rounded-control border border-text/25 bg-bg/40 px-6 text-[17px] font-semibold text-text backdrop-blur-sm transition-colors hover:border-text/50 hover:bg-bg/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {ctaSecondary}
            </a>
          </div>

          <ul className="mt-2 grid grid-cols-3 gap-2.5 sm:gap-3">
            {stats.map((stat) => (
              <li
                key={stat.label}
                className="flex min-w-0 flex-col gap-1 rounded-card border border-text/15 bg-bg/70 px-2.5 py-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,.7)] backdrop-blur-lg sm:px-4"
              >
                <span className="font-display text-[clamp(18px,5.6vw,24px)] leading-none font-medium text-text sm:text-[32px]">
                  {stat.value}
                </span>
                <span className="text-[12px] leading-snug text-text/80 sm:text-[13px]">{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <a
        href="#ticker"
        aria-label={scrollHint}
        className="absolute inset-x-0 bottom-4 z-10 mx-auto hidden w-fit rounded-control px-3 py-2 text-text-secondary transition-colors hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:block"
      >
        <ChevronDown size={22} strokeWidth={1.75} aria-hidden="true" className="motion-safe:animate-bounce" />
      </a>
    </section>
  )
}
