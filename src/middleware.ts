import { NextResponse, type NextRequest } from 'next/server'
import { resolveSurface, rewriteTarget } from '@/shared/surface'

const WWW_HOST = 'www.maxosipov.ru'
const CANONICAL_HOST = 'maxosipov.ru'

/** Разделяет сайт и приложение по `Host`: ARCHITECTURE.md §4. */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const hostname = (host ?? '').toLowerCase().replace(/:\d+$/, '')

  if (hostname === WWW_HOST) {
    const redirectUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    )
    return NextResponse.redirect(redirectUrl, 308)
  }

  const target = rewriteTarget(resolveSurface(host), request.nextUrl.pathname)
  if (!target) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
