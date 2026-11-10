import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  href: string
  children: ReactNode
  /** Крупная кнопка первого экрана и блоков «Тариф» / «Как начать». */
  size?: 'lg' | 'md'
  className?: string
}

/**
 * Красная кнопка лендинга — всегда ведёт на `${APP_URL}/login` (план, Global Constraints).
 * Текст 19 px полужирный: на акцентном фоне это «крупный текст» по WCAG, контраст ≥ 3:1.
 */
export function CtaLink({ href, children, size = 'lg', className }: Props) {
  const padding = size === 'lg' ? 'h-14 px-7 text-[19px]' : 'h-12 px-6 text-[17px]'

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-control bg-accent font-semibold text-white transition-colors hover:bg-accent-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${padding} ${className ?? ''}`}
    >
      {children}
      <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
    </a>
  )
}
