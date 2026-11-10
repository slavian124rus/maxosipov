'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InsideItem } from '../../../content/landing'
import { PhoneFrame } from './phone-frame'

type Props = { items: InsideItem[]; label: string }

/** Пауза между автопереключениями экранов. */
const AUTO_MS = 6500

/**
 * Вкладки «Что внутри»: слева список функций (активная раскрыта), справа телефон с экраном.
 * Сам листает экраны, пока блок на виду и человек ничего не нажимал; после нажатия — стоит.
 * Кнопки — настоящий tablist: стрелки переключают вкладки, Tab уходит дальше.
 */
export function InsideTabs({ items, label }: Props) {
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)
  const [visible, setVisible] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), {
      threshold: 0.35,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!auto || !visible) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % items.length), AUTO_MS)
    return () => window.clearTimeout(timer)
  }, [auto, visible, index, items.length])

  const select = useCallback((next: number) => {
    setAuto(false)
    setIndex(next)
  }, [])

  const onKeyDown = (event: React.KeyboardEvent, current: number) => {
    let next = current
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % items.length
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    select(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="grid items-center gap-10 lg:grid-cols-[1.1fr_auto] lg:gap-20"
    >
      <div role="tablist" aria-label={label} aria-orientation="vertical" className="flex flex-col gap-3">
        {items.map((item, i) => {
          const active = i === index
          return (
            <div
              key={item.title}
              className={`relative overflow-hidden rounded-card border transition-colors duration-200 ${
                active ? 'border-muscle-primary/50 bg-surface-1' : 'border-border bg-surface-1/40 hover:border-border hover:bg-surface-1/70'
              }`}
            >
              <button
                ref={(node) => {
                  tabRefs.current[i] = node
                }}
                type="button"
                role="tab"
                id={`inside-tab-${i}`}
                aria-selected={active}
                aria-controls="inside-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={(event) => onKeyDown(event, i)}
                className="flex min-h-16 w-full items-center gap-4 p-4 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:p-5"
              >
                <span
                  aria-hidden="true"
                  className={`font-display text-[32px] leading-none font-medium transition-colors md:text-[40px] ${
                    active ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`font-display text-[20px] leading-tight font-medium transition-colors md:text-[24px] ${
                    active ? 'text-text' : 'text-text-secondary'
                  }`}
                >
                  {item.title}
                </span>
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-5 text-[15px] leading-relaxed text-text-secondary md:px-5 md:pl-[88px] md:text-[16px]">
                    {item.text}
                  </p>
                </div>
              </div>

              {/* Полоска таймера до следующего экрана: показывает, что вкладки листаются сами. */}
              {active && auto && visible ? (
                <span
                  key={`timer-${index}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent motion-safe:animate-[underline-grow_6.5s_linear_both]"
                />
              ) : null}
            </div>
          )
        })}
      </div>

      <div
        id="inside-panel"
        role="tabpanel"
        aria-labelledby={`inside-tab-${index}`}
        className="relative mx-auto w-[268px] max-w-full"
      >
        <div
          aria-hidden="true"
          className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(229,50,45,.28),transparent_70%)] blur-2xl"
        />
        <PhoneFrame
          screens={items.map((item) => ({ src: item.image, alt: `${item.title} — экран приложения` }))}
          activeIndex={index}
        />
      </div>
    </div>
  )
}
