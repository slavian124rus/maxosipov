'use client'

import { useEffect, useState } from 'react'

type Props = {
  monogram: string
  brand: string
  brandNote: string
  loginLabel: string
  loginHref: string
}

/**
 * Шапка лендинга (план, задача 1, шаг 3): монограмма «МО» + «Максим Осипов»,
 * справа кнопка «Войти» на `${APP_URL}/login`. Фон появляется после прокрутки,
 * чтобы не спорить с видео первого экрана.
 */
export function SiteHeader({ monogram, brand, brandNote, loginLabel, loginHref }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? 'border-border bg-bg/85 backdrop-blur-md' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-3 rounded-control focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-control border border-muscle-primary/40 bg-muscle-primary/10 font-display text-[15px] font-medium text-text"
          >
            {monogram}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-display text-[17px] leading-tight font-medium tracking-[0.02em] text-text">
              {brand}
            </span>
            <span className="truncate text-[12px] leading-tight text-text-secondary">{brandNote}</span>
          </span>
        </a>

        <a
          href={loginHref}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-control border border-border bg-surface-1/70 px-5 text-[15px] font-semibold text-text backdrop-blur-sm transition-colors hover:border-muscle-primary/60 hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {loginLabel}
        </a>
      </div>
    </header>
  )
}
