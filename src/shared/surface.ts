export type Surface = 'site' | 'app'

/** Отрезает порт: `app.localhost:3000` → `app.localhost`, `[::1]:3000` → `[::1]`. */
function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const closing = host.indexOf(']')
    return closing === -1 ? host : host.slice(0, closing + 1)
  }
  const colon = host.lastIndexOf(':')
  return colon === -1 ? host : host.slice(0, colon)
}

/**
 * Определяет, что открыл пользователь: лендинг (`site`) или приложение (`app`).
 * `app.maxosipov.ru` → приложение; всё остальное, включая `null`, — сайт.
 */
export function resolveSurface(host: string | null): Surface {
  if (!host) return 'site'
  const hostname = stripPort(host.trim().toLowerCase())
  return hostname.startsWith('app.') ? 'app' : 'site'
}

const PASSTHROUGH_PREFIXES = ['/app', '/api', '/_next', '/media'] as const

/** Файл — если в последнем сегменте пути есть точка (`/sw.js`, `/icons/icon-192.png`). */
function isFileRequest(pathname: string): boolean {
  const lastSegment = pathname.split('/').pop() ?? ''
  return lastSegment.includes('.')
}

/**
 * Куда переписать запрос в `middleware.ts`.
 * `null` — оставить путь как есть, `/404` — отдать страницу 404.
 */
export function rewriteTarget(surface: Surface, pathname: string): string | null {
  if (surface === 'site') {
    return pathname === '/app' || pathname.startsWith('/app/') ? '/404' : null
  }

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null
  }

  if (isFileRequest(pathname)) return null

  return `/app${pathname === '/' ? '' : pathname}`
}
