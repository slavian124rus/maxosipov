'use client'

import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 30_000

/**
 * Опрос версии программы раз в 30 с — только пока вкладка видима и есть сеть.
 * Первое полученное значение запоминается: плашка появляется при его смене.
 */
export function useProgramVersion(programId: string | null): boolean {
  const [hasUpdate, setHasUpdate] = useState(false)
  const initialVersion = useRef<string | null>(null)

  useEffect(() => {
    if (!programId) return

    let cancelled = false

    async function check(): Promise<void> {
      if (document.hidden || !navigator.onLine) return

      try {
        const response = await fetch(
          `/api/training/program-version?programId=${encodeURIComponent(programId!)}`,
        )
        if (!response.ok) return

        const body = (await response.json()) as { version?: string }
        if (cancelled || !body.version) return

        if (initialVersion.current === null) initialVersion.current = body.version
        else if (initialVersion.current !== body.version) setHasUpdate(true)
      } catch {
        // без сети просто ждём следующего опроса
      }
    }

    void check()
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS)
    const onVisible = (): void => {
      if (!document.hidden) void check()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [programId])

  return hasUpdate
}