'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  /** Публичный ключ VAPID с сервера; `null` — push не настроен. */
  vapidPublicKey: string | null
}

type State = 'loading' | 'ready' | 'granted' | 'denied' | 'unsupported' | 'ios-hint' | 'sending'

/** `applicationServerKey` ждёт байты, а ключ приходит base64url-строкой. */
function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function isIosWithoutPwa(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true

  return ios && !standalone
}

/**
 * Карточка «Включи уведомления» (DESIGN.md §8.1). Разрешение спрашиваем только
 * по нажатию кнопки — никогда при входе (план этапа 5).
 */
export function PushOptIn({ vapidPublicKey }: Props) {
  const [state, setState] = useState<State>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function detect(): Promise<void> {
      if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported')
        return
      }

      if (isIosWithoutPwa()) {
        if (!cancelled) setState('ios-hint')
        return
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }

      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration()
        const existing = await registration?.pushManager.getSubscription()
        if (!cancelled) setState(existing ? 'granted' : 'ready')
        return
      }

      if (!cancelled) setState('ready')
    }

    void detect()
    return () => {
      cancelled = true
    }
  }, [vapidPublicKey])

  async function enable(): Promise<void> {
    if (!vapidPublicKey) return

    setState('sending')
    setError(null)

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'ready')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (!response.ok) {
        setError('Не удалось включить уведомления. Попробуй позже')
        setState('ready')
        return
      }

      setState('granted')
    } catch {
      setError('Не удалось включить уведомления. Попробуй позже')
      setState('ready')
    }
  }

  if (state === 'loading' || state === 'unsupported' || state === 'granted') return null

  if (state === 'ios-hint') {
    return (
      <div className="rounded-card border border-border bg-surface-1 px-4 py-3">
        <p className="text-[15px] text-text">Сначала установи приложение на экран „Домой“</p>
        <p className="mt-1 text-[13px] text-text-muted">
          В Safari: «Поделиться» → «На экран „Домой“». После этого здесь появится кнопка включения
          уведомлений.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
      <p className="text-[15px] text-text">
        Включи уведомления — напомним о подписке и покажем, когда Максим обновит программу
      </p>

      {state === 'denied' ? (
        <p className="text-[13px] text-text-muted">
          Уведомления выключены в настройках браузера. Включи их для этого сайта и обнови страницу.
        </p>
      ) : (
        <Button type="button" onClick={() => void enable()} disabled={state === 'sending'}>
          {state === 'sending' ? 'Включаем…' : 'Включить'}
        </Button>
      )}

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  )
}