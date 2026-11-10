'use client'

import { ArrowRight, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'

type Props = { href: string; label: string; closeLabel: string }

const DISMISS_KEY = 'mobile-cta-dismissed'
const DISMISS_EVENT = 'mobile-cta-dismiss'

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // Хранилище недоступно — закрытие не запоминается.
    return false
  }
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange)
  return () => window.removeEventListener(DISMISS_EVENT, onChange)
}

/**
 * Ненавязчивая «таблетка» внизу экрана на телефоне: стекло с красной точкой и короткой
 * подписью, ведёт на регистрацию в приложении. Появляется после первого экрана, прячется
 * у контактов и закрывается крестиком (до конца визита). Узкая и по центру, не полоса
 * на всю ширину. Под большим пальцем — DESIGN.md §1.
 */
export function MobileCta({ href, label, closeLabel }: Props) {
  const [shown, setShown] = useState(false)
  // На сервере кнопка «не закрыта»; на клиенте значение берётся из sessionStorage без гонки гидратации.
  const stored = useSyncExternalStore(subscribeDismissed, readDismissed, () => false)
  const [closed, setClosed] = useState(false)
  const dismissed = stored || closed

  useEffect(() => {
    const update = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.8
      const contacts = document.getElementById('contacts')
      const nearEnd = contacts ? contacts.getBoundingClientRect().top < window.innerHeight * 0.6 : false
      setShown(pastHero && !nearEnd)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Не запомнилось — кнопка скроется только до перезагрузки страницы.
    }
    setClosed(true)
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  if (dismissed) return null

  const visible = shown

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))] transition-all duration-300 md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <div
        className={`flex max-w-full items-center rounded-full border border-text/15 bg-bg/70 shadow-[0_12px_40px_-12px_rgba(0,0,0,.8)] backdrop-blur-xl ${
          visible ? 'pointer-events-auto' : ''
        }`}
      >
        <a
          href={href}
          tabIndex={visible ? 0 : -1}
          className="flex min-h-12 min-w-0 items-center gap-2.5 rounded-full py-2 pr-3 pl-4 text-left text-[14px] leading-tight font-semibold text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-muscle-primary motion-safe:animate-pulse" />
          <span className="min-w-0">{label}</span>
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-muscle-primary" />
        </a>
        <button
          type="button"
          aria-label={closeLabel}
          tabIndex={visible ? 0 : -1}
          onClick={dismiss}
          className="mr-1 grid size-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
