'use client'

import { useSyncExternalStore } from 'react'
import { Switch } from '@/components/ui/switch'
import { WORKOUT_NOTIFY_PREF_KEY, workoutNotifyEnabled } from '@/lib/offline/workout-notify'

/** «Показывать тренировку на экране блокировки»: включено по умолчанию, если есть разрешение на уведомления. */
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

type Permission = NotificationPermission | 'unsupported'

export function LockscreenToggle() {
  // На сервере считаем «выключено» и без разрешения — браузер поправит после гидрации.
  const on = useSyncExternalStore(subscribe, workoutNotifyEnabled, () => false)
  const permission = useSyncExternalStore<Permission>(
    subscribe,
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
    () => 'default',
  )

  function change(next: boolean): void {
    try {
      localStorage.setItem(WORKOUT_NOTIFY_PREF_KEY, next ? '1' : '0')
    } catch {
      // без памяти устройства настройка не сохранится
    }
    for (const listener of listeners) listener()
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface-1 px-3 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] text-text">Тренировка на экране блокировки</p>
        <p className="text-[13px] text-text-muted">
          {permission === 'granted'
            ? 'Пока идёт тренировка, в шторке виден текущий подход. На Android можно записать подход кнопкой.'
            : permission === 'unsupported'
              ? 'Это устройство не умеет показывать такие уведомления.'
              : 'Сначала включи уведомления выше.'}
        </p>
      </div>
      <Switch
        checked={on && permission === 'granted'}
        disabled={permission !== 'granted'}
        onCheckedChange={change}
        aria-label="Тренировка на экране блокировки"
      />
    </div>
  )
}
