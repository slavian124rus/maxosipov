'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { findActiveSession } from '@/lib/offline/queue'
import { STALE_SESSION_MS } from '@/lib/offline/use-active-session'

/** Какой день продолжать: свежая незавершённая тренировка из памяти устройства. */
export function resumeDayId(
  days: { id: string }[],
  session: { programDayId: string | null; startedAt: string } | null,
  now = Date.now(),
): string | null {
  if (!session?.programDayId) return null
  if (now - new Date(session.startedAt).getTime() >= STALE_SESSION_MS) return null

  return days.some((day) => day.id === session.programDayId) ? session.programDayId : null
}

/**
 * «Продолжить тренировку» на экране «Сегодня» (DESIGN.md §8.1).
 *
 * Тренировка живёт в памяти устройства, поэтому сервер о ней не знает: подсказку
 * показывает этот компонент. Без неё клиент, выбравший другой день, вернулся бы на
 * «Сегодня», увидел рекомендованный день и, нажав «Начать», закрыл бы начатую тренировку.
 */
export function ResumeHint({ days }: { days: { id: string; name: string }[] }) {
  const [active, setActive] = useState<{ id: string; name: string } | null>(null)

  // Зависимость — «отпечаток» дней: массив приходит новый на каждый рендер сервера.
  const daysKey = days.map((day) => `${day.id}:${day.name}`).join('|')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const session = await findActiveSession()
        const dayId = resumeDayId(days, session)
        const day = dayId ? days.find((item) => item.id === dayId) : null
        if (day && !cancelled) setActive(day)
      } catch {
        // Память устройства недоступна — просто не показываем подсказку.
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- daysKey описывает days
  }, [daysKey])

  if (!active) return null

  return (
    <Link
      href={`/workout?day=${active.id}`}
      className="flex min-h-12 items-center justify-center rounded-control border border-accent bg-surface-2 px-4 text-[15px] text-text"
    >
      Продолжить: {active.name}
    </Link>
  )
}
