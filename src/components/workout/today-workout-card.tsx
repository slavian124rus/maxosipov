'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { findActiveSession } from '@/lib/offline/queue'
import { STALE_SESSION_MS } from '@/lib/offline/use-active-session'
import { DayPicker } from './day-picker'

export type TodayDay = { id: string; name: string; exercises: number }

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
 * Карточка тренировки на экране «Сегодня» (DESIGN.md §8.1).
 *
 * Начатая тренировка может быть известна двум местам: серверу (строка в
 * `workout_sessions` без `finished_at`) и памяти устройства (IndexedDB, когда старт ещё
 * не ушёл в сеть). Раньше подсказка «Продолжить» жила отдельно от кнопки «Начать»:
 * клиент видел обе и, нажав «Начать», закрывал свою же тренировку. Теперь это одна
 * кнопка — «Продолжить тренировку» с днём, который реально идёт.
 */
export function TodayWorkoutCard({
  days,
  recommendedId,
  ongoingDayId = null,
}: {
  days: TodayDay[]
  /** Следующий день по порядку — когда ничего не начато. */
  recommendedId: string
  /** День начатой тренировки по данным сервера. */
  ongoingDayId?: string | null
}) {
  const [deviceDayId, setDeviceDayId] = useState<string | null>(null)

  // Зависимость — «отпечаток» дней: массив приходит новый на каждый рендер сервера.
  const daysKey = days.map((day) => `${day.id}:${day.name}`).join('|')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const session = await findActiveSession()
        const dayId = resumeDayId(days, session)
        if (dayId && !cancelled) setDeviceDayId(dayId)
      } catch {
        // Память устройства недоступна — остаётся только то, что знает сервер.
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- daysKey описывает days
  }, [daysKey])

  const activeDay =
    days.find((day) => day.id === (ongoingDayId ?? deviceDayId)) ??
    null
  const shown = activeDay ?? days.find((day) => day.id === recommendedId) ?? days[0] ?? null

  if (!shown) return null

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
      <p className="text-[13px] text-text-muted">{activeDay ? 'Начата тренировка' : 'Сегодня'}</p>
      <p className="text-[17px]">{shown.name}</p>
      <p className="text-[15px] text-text-secondary">
        {activeDay
          ? 'Подходы уже записаны — продолжай с того же места'
          : `Упражнений: ${shown.exercises}`}
      </p>
      <Link
        href={`/workout?day=${shown.id}`}
        className="flex h-12 items-center justify-center rounded-control bg-accent text-[15px] text-white"
      >
        {activeDay ? 'Продолжить тренировку' : 'Начать тренировку'}
      </Link>
      {days.length > 1 ? (
        <DayPicker days={days} recommendedId={shown.id} ongoing={Boolean(activeDay)} />
      ) : null}
    </section>
  )
}
