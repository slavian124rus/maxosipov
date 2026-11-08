/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, Serwist, Strategy, type StrategyHandler } from 'serwist'

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

for (const entry of defaultCache) {
  serwist.registerCapture(entry.matcher, entry.handler, entry.method)
}

// Видео и постеры упражнений: кэшируем без query-параметров подписи,
// иначе каждая новая ссылка считалась бы новым файлом.
serwist.registerCapture(
  ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.startsWith('/media/') && /\.(mp4|webm|webp|jpg)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'media',
    plugins: [
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

serwist.addEventListeners()
