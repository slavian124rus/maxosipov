'use client'

import { useEffect } from 'react'
import { flushAll } from '@/lib/offline/queue'

const INTERVAL_MS = 15_000

/**
 * Фоновая синхронизация тренировок: каждые 15 с, при возвращении сети и при возврате на вкладку.
 * Стоит в оболочке клиента, поэтому работает на любом экране, а не только на «Тренировке».
 */
export function OfflineSync() {
  useEffect(() => {
    const run = (): void => {
      if (navigator.onLine) void flushAll().catch(() => undefined)
    }

    run()
    const timer = setInterval(run, INTERVAL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') run()
    }

    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
