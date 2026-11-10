'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Задержка в секундах — для появления реплик по очереди (план, задача 1). */
  delay?: number
  /** Насколько сильно блок «выезжает» снизу, px. */
  offset?: number
  className?: string
  /** Доля блока, при которой начинается анимация. */
  amount?: number
}

/**
 * Появление блока при прокрутке (Motion `whileInView`, DESIGN.md §5: 150–250 мс, easeOut).
 * При `prefers-reduced-motion` анимации нет — контент виден сразу.
 */
export function Reveal({ children, delay = 0, offset = 20, className, amount = 0.2 }: Props) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.25, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
