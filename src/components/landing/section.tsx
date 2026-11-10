import type { ReactNode } from 'react'
import { Reveal } from './reveal'

type Props = {
  id?: string
  /** Короткая подписка над заголовком. Без КАПСА — DESIGN.md §4. */
  eyebrow?: string
  title?: string
  lead?: string
  children?: ReactNode
  className?: string
  /** Ширина содержимого: обычная (1200) или узкая (760) для текстовых блоков. */
  narrow?: boolean
}

/**
 * Оболочка блока лендинга: поля, максимальная ширина и заголовок с появлением при
 * прокрутке. Отступы — сетка DESIGN.md §5 (кратны 4/8).
 */
export function Section({ id, eyebrow, title, lead, children, className, narrow }: Props) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-20 px-4 py-16 sm:px-6 md:py-24 ${className ?? ''}`}
    >
      <div
        className={`mx-auto flex w-full flex-col gap-8 ${narrow ? 'max-w-[760px]' : 'max-w-[1200px]'}`}
      >
        {eyebrow || title || lead ? (
          <Reveal className="flex flex-col gap-3">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 className="max-w-[680px] font-display text-[30px] leading-[1.06] font-medium text-text md:text-[44px]">
                {title}
              </h2>
            ) : null}
            {lead ? (
              <p className="max-w-[620px] text-[15px] leading-relaxed text-text-secondary md:text-[17px]">
                {lead}
              </p>
            ) : null}
          </Reveal>
        ) : null}

        {children}
      </div>
    </section>
  )
}

/** Подпись блока: тонкая красная черта и короткий текст. Контраст ≥ 4.5:1 (DESIGN §3). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[13px] font-semibold tracking-[0.08em] text-muscle-primary">
      <span aria-hidden="true" className="h-px w-8 bg-muscle-primary/60" />
      {children}
    </p>
  )
}
