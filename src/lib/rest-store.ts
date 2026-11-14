'use client'

import { useSyncExternalStore } from 'react'

const KEY = 'maxim.rest'
const EVENT = 'maxim-rest-change'

export type Rest = { id: string; endsAt: number; seconds: number }

function emit(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function write(rest: Rest | null): void {
  try {
    if (rest) localStorage.setItem(KEY, JSON.stringify(rest))
    else localStorage.removeItem(KEY)
  } catch {
    // без памяти устройства отдых просто не переживёт уход со страницы
  }
  emit()
}

function parse(raw: string | null): Rest | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<Rest>
    if (typeof value.id !== 'string' || typeof value.endsAt !== 'number' || typeof value.seconds !== 'number') {
      return null
    }
    return value.endsAt > Date.now() ? (value as Rest) : null
  } catch {
    return null
  }
}

/** Текущий отдых: хранится в памяти устройства, поэтому переживает переход на другую страницу. */
export function readRest(): Rest | null {
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function startRest(id: string, seconds: number): void {
  write({ id, endsAt: Date.now() + seconds * 1000, seconds })
}

export function addRest(extraSeconds: number): void {
  const rest = readRest()
  if (!rest) return
  write({ ...rest, endsAt: rest.endsAt + extraSeconds * 1000, seconds: rest.seconds + extraSeconds })
}

export function clearRest(): void {
  write(null)
}

export function remainingSeconds(rest: Rest, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
}

// useSyncExternalStore требует стабильный снимок: отдаём строку и разбираем снаружи.
function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

function snapshot(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Идущий отдых для экрана; на сервере и до гидрации — `null`. */
export function useRest(): Rest | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null)
  return parse(raw)
}
