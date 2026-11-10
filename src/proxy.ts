import { NextResponse, type NextRequest } from 'next/server'
import { isTrainerPath, resolveSurface, rewriteTarget } from '@/shared/surface'

const WWW_HOST = 'www.maxosipov.ru'
const CANONICAL_HOST = 'maxosipov.ru'

/** Разделяет сайт и приложение по `Host`: ARCHITECTURE.md §4. */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host')
  const hostname = (host ?? '').toLowerCase().replace(/:\d+$/, '')

  if (hostname === WWW_HOST) {
    const redirectUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    )
    return NextResponse.redirect(redirectUrl, 308)
  }

  const surface = resolveSurface(host)

  // Кабинет тренера переехал на admin.*: старые ссылки и пуши на app.*/trainer ведут туда.
  if (surface === 'app' && isTrainerPath(request.nextUrl.pathname)) {
    // Адрес собираем из Host и X-Forwarded-Proto: за Caddy `request.url` может быть внутренним.
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    const adminHost = (host ?? '').replace(/^app\./i, 'admin.')
    const target = `${proto}://${adminHost}${request.nextUrl.pathname}${request.nextUrl.search}`
    return NextResponse.redirect(target, 308)
  }

  const target = rewriteTarget(surface, request.nextUrl.pathname)
  if (!target) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
