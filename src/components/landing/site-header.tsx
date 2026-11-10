'use client'

import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type NavLink = { href: string; label: string }

type Props = {
  logo: string
  brand: string
  brandNote: string
  links: readonly NavLink[]
  loginLabel: string
  loginHref: string
  ctaLabel: string
  ctaShortLabel: string
  menuOpenLabel: string
  menuCloseLabel: string
}

/**
 * Шапка лендинга: логотип и имя слева, ссылки на блоки по центру (подсвечивается текущий),
 * справа «Войти» и красная кнопка. На телефоне — «Месяц бесплатно» и меню-«бургер».
 * Тонкая красная полоса снизу показывает, сколько страницы прочитано.
 */
export function SiteHeader({
  logo,
  brand,
  brandNote,
  links,
  loginLabel,
  loginHref,
  ctaLabel,
  ctaShortLabel,
  menuOpenLabel,
  menuCloseLabel,
}: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const progressRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      const max = document.documentElement.scrollHeight - window.innerHeight
      const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Текущий блок: последний, чей верх уже выше линии на 40% высоты экрана (и низ ниже неё).
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.4
      let current: string | null = null
      for (const link of links) {
        const node = document.getElementById(link.href.slice(1))
        if (!node) continue
        const rect = node.getBoundingClientRect()
        if (rect.top <= line && rect.bottom > line) current = node.id
      }
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [links])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const solid = scrolled || open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        solid ? 'border-border bg-bg/90 backdrop-blur-md' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 md:h-[72px]">
        <a
          href="#top"
          onClick={() => setOpen(false)}
          className="flex min-w-0 items-center gap-2.5 rounded-control focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип из public/ */}
          <img src={logo} alt="" width={44} height={44} className="size-10 shrink-0 md:size-11" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-display text-[17px] leading-tight font-medium tracking-[0.04em] text-text uppercase md:text-[18px]">
              {brand}
            </span>
            <span className="hidden truncate text-[12px] leading-tight text-text-secondary sm:block">{brandNote}</span>
          </span>
        </a>

        <nav aria-label="Разделы страницы" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const isActive = active === link.href.slice(1)
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'true' : undefined}
                className={`relative rounded-control px-3 py-2 text-[15px] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                  isActive ? 'text-text' : 'text-text-secondary hover:text-text'
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-accent transition-transform duration-200 ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </a>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={loginHref}
            className="hidden h-11 items-center justify-center rounded-control px-4 text-[15px] font-semibold text-text transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:inline-flex"
          >
            {loginLabel}
          </a>
          <a
            href={loginHref}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-[15px] font-bold min-[360px]:px-4 text-white transition-colors hover:bg-accent-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="sm:hidden">{ctaShortLabel}</span>
            <span className="hidden sm:inline">{ctaLabel}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="hidden sm:block" />
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? menuCloseLabel : menuOpenLabel}
            onClick={() => setOpen((value) => !value)}
            className="grid size-11 place-items-center rounded-control border border-border bg-surface-1/70 text-text transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
          >
            {open ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Разделы страницы"
          className="border-t border-border bg-bg/95 px-4 pt-2 pb-5 backdrop-blur-md lg:hidden"
        >
          <ul className="mx-auto flex max-w-[1200px] flex-col">
            {links.map((link) => (
              <li key={link.href} className="border-b border-border/60 last:border-0">
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center justify-between font-display text-[22px] font-medium text-text"
                >
                  {link.label}
                  <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-text-muted" />
                </a>
              </li>
            ))}
            <li className="pt-4">
              <a
                href={loginHref}
                className="flex h-12 items-center justify-center rounded-control border border-border bg-surface-1 text-[15px] font-semibold text-text"
              >
                {loginLabel}
              </a>
            </li>
          </ul>
        </nav>
      ) : null}

      <span
        ref={progressRef}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[-1px] h-0.5 origin-left scale-x-0 bg-accent"
      />
    </header>
  )
}
