import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Задержка в секундах — для появления реплик по очереди (план, задача 1). */
  delay?: number
  className?: string
}

/**
 * Появление блока при прокрутке (Motion, DESIGN.md §5: 250 мс, easeOut).
 *
 * В SSR это обычный полностью видимый блок с меткой `data-reveal`: контент не
 * красится в `opacity: 0` до гидратации и читается без JS (LCP, SEO, доступность).
 * Анимацию навешивает `RevealDriver` после `load`, подгружая Motion лениво, —
 * библиотека не попадает в критический путь первого экрана.
 */
export function Reveal({ children, delay = 0, className }: Props) {
  return (
    <div className={className} data-reveal="" data-reveal-delay={delay > 0 ? delay : undefined}>
      {children}
    </div>
  )
}
