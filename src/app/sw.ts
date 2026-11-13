/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  addSetFromNotification,
  WORKOUT_ADD_SET_ACTION,
} from '@/lib/offline/workout-notify'
import {
  CacheFirst,
  ExpirationPlugin,
  RangeRequestsPlugin,
  Serwist,
  Strategy,
  type StrategyHandler,
} from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Публичный адрес на хосте приложения; `/app/offline` напрямую не открывается.
const OFFLINE_URL = '/offline'

/**
 * Навигации: сеть → кэш → офлайн-страница.
 * `fallbacks` из Serwist 9.5.13 не вызывает плагин `handlerDidError`,
 * поэтому офлайн-заглушку отдаём явно.
 */
class PagesWithOfflineFallback extends Strategy {
  private readonly serwist: Serwist

  constructor(serwist: Serwist) {
    super({ cacheName: 'pages' })
    this.serwist = serwist
  }

  protected async _handle(
    request: Request,
    handler: StrategyHandler,
  ): Promise<Response | undefined> {
    try {
      const response = await handler.fetch(request)
      if (response.ok) await handler.cachePut(request, response.clone())
      return response
    } catch {
      const cached = await handler.cacheMatch(request)
      if (cached) return cached
      return this.serwist.matchPrecache(OFFLINE_URL)
    }
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
})

serwist.registerCapture(
  ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
  new PagesWithOfflineFallback(serwist),
)

// Правило для /media/ регистрируется ДО defaultCache: в production там есть общий перехватчик
// «любой same-origin → NetworkFirst», который иначе забрал бы видео себе (первое совпадение выигрывает).
// Видео и постеры упражнений: кэшируем без query-параметров подписи,
// иначе каждая новая ссылка считалась бы новым файлом.
serwist.registerCapture(
  ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.startsWith('/media/') && /\.(mp4|webm|webp|jpg)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'media',
    plugins: [
      // <video> просит диапазоны (iOS Safari — обязательно): отдаём 206 из целого файла в кэше
      new RangeRequestsPlugin(),
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          const url = new URL(request.url)
          url.search = ''
          return url.toString()
        },
      },
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

for (const entry of defaultCache) {
  serwist.registerCapture(entry.matcher, entry.handler, entry.method)
}

serwist.addEventListeners()

// ── Web Push (этап 5): уведомления и переход по клику ─────────────────────────

type PushPayload = { title?: string; body?: string; url?: string; icon?: string; badge?: string }

function readPayload(event: PushEvent): PushPayload {
  try {
    return event.data ? (JSON.parse(event.data.text()) as PushPayload) : {}
  } catch {
    return {}
  }
}

self.addEventListener('push', (event: PushEvent) => {
  const payload = readPayload(event)
  const icon = payload.icon ?? '/icons/icon-192.png'

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'МаксИИм', {
      body: payload.body ?? '',
      icon,
      badge: payload.badge ?? icon,
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const data = event.notification.data as { kind?: string; sessionClientUuid?: string } | undefined

  // «+ Подход» в уведомлении тренировки: записываем подход и перерисовываем уведомление.
  if (data?.kind === 'workout' && event.action === WORKOUT_ADD_SET_ACTION && data.sessionClientUuid) {
    const sessionClientUuid = data.sessionClientUuid

    event.waitUntil(
      (async () => {
        const added = await addSetFromNotification(self.registration, sessionClientUuid)
        if (!added) return

        // Открытый экран перечитывает подходы из IndexedDB.
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of windows) client.postMessage({ type: 'workout-set-added' })
      })(),
    )
    return
  }

  event.notification.close()

  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  const target = new URL(url, self.location.origin).toString()

  event.waitUntil(
    (async () => {
      // Если приложение уже открыто — фокусируем окно и ведём на нужный экран.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }

      await self.clients.openWindow(target)
    })(),
  )
})
