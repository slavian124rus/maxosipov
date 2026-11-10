'use client'

import { useEffect } from 'react'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

/**
 * Оживляет блоки `[data-reveal]` после загрузки страницы: Motion подгружается
 * лениво (`import('motion')`), поэтому не попадает в критический путь LCP.
 * Без JS или при `prefers-reduced-motion` контент остаётся видимым как есть.
 */
export function RevealDriver() {
  useEffect(() => {
    let cancelled = false
    const unobservers: VoidFunction[] = []

    const run = async () => {
      if (cancelled) return
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

      const motion = await import('motion')
      if (cancelled) return

      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

      for (const node of nodes) {
        const delay = Number(node.dataset.revealDelay ?? 0)
        const alreadyVisible = node.getBoundingClientRect().top < window.innerHeight

        // Невидимые пока блоки прячем: их появление человек увидит при прокрутке.
        if (!alreadyVisible) node.style.opacity = '0'

        const unobserve = motion.inView(
          node,
          () => {
            unobserve()
            motion.animate(
              node,
              { opacity: [0, 1], y: [20, 0] },
              { duration: 0.25, ease: 'easeOut', delay },
            )
          },
          { amount: 0.2 },
        )

        unobservers.push(unobserve)
      }
    }

    const schedule = () => {
      const idleWindow = window as IdleWindow
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleWindow.requestIdleCallback(() => void run(), { timeout: 1500 })
      } else {
        window.setTimeout(() => void run(), 300)
      }
    }

    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })

    return () => {
      cancelled = true
      for (const unobserve of unobservers) unobserve()
    }
  }, [])

  return null
}
