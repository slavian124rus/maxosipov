export type Surface = 'site' | 'app' | 'admin'

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
 * Определяет, что открыл пользователь: лендинг (`site`), приложение (`app`) или кабинет (`admin`).
 * `app.maxosipov.ru` → приложение, `admin.maxosipov.ru` → кабинет; всё остальное, включая `null`, — сайт.
 */
export function resolveSurface(host: string | null): Surface {
  if (!host) return 'site'
  const hostname = stripPort(host.trim().toLowerCase())
  if (hostname.startsWith('admin.')) return 'admin'
  return hostname.startsWith('app.') ? 'app' : 'site'
}

const PASSTHROUGH_PREFIXES = ['/api', '/_next', '/media'] as const

/** Файл — если в последнем сегменте пути есть точка (`/sw.js`, `/icons/icon-192.png`). */
function isFileRequest(pathname: string): boolean {
  const lastSegment = pathname.split('/').pop() ?? ''
  return lastSegment.includes('.')
}

/**
 * Куда переписать запрос в `proxy.ts`.
 * `null` — оставить путь как есть, `/404` — отдать страницу 404.
 */
export function rewriteTarget(surface: Surface, pathname: string): string | null {
  // Внутренние пути `/app/*` напрямую не открываются ни на сайте, ни в приложении
  // (ARCHITECTURE.md §8.4): в приложение попадают только через rewrite.
  const isInternal = pathname === '/app' || pathname.startsWith('/app/')
  if (surface === 'site') return isInternal ? '/404' : null
  if (isInternal) return '/404'
  // Кабинет тренера живёт только на admin.*; на app.* его нет (proxy.ts переводит туда).
  if (surface === 'app' && isTrainerPath(pathname)) return '/404'

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null
  }

  if (isFileRequest(pathname)) return null

  if (surface === 'admin') return adminTarget(pathname)

  return `/app${pathname === '/' ? '' : pathname}`
}

/** Путь кабинета тренера: `/trainer` и всё под ним. */
export function isTrainerPath(pathname: string): boolean {
  return pathname === '/trainer' || pathname.startsWith('/trainer/')
}

/** Общие экраны, доступные и на admin.*: вход, юридические страницы. */
const ADMIN_SHARED_PREFIXES = ['/login', '/legal'] as const

function adminTarget(pathname: string): string {
  if (pathname === '/') return '/app/trainer'
  if (isTrainerPath(pathname)) return `/app${pathname}`
  if (ADMIN_SHARED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return `/app${pathname}`
  }
  return '/404'
}
