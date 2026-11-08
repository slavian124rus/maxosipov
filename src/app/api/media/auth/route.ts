import { NextResponse } from 'next/server'
import { verifyMediaRequest } from '@/modules/media'

/**
 * Проверка подписи для Caddy (`forward_auth`). Caddy присылает исходный URI
 * в `X-Forwarded-Uri`; 2xx — отдавать файл, иначе Caddy вернёт наш ответ клиенту.
 */
export async function GET(request: Request) {
  const uri = request.headers.get('x-forwarded-uri') ?? ''

  // Проверяем «..» до нормализации URL: `new URL` схлопывает `/a/../b`.
  if (!uri || uri.split('?')[0]?.split('/').includes('..')) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  let url: URL
  try {
    url = new URL(uri, 'http://internal')
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const relPath = url.pathname.replace(/^\/media\//, '').replace(/^\//, '')

  if (!relPath) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''

  if (!verifyMediaRequest(relPath, exp, sig)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(null, { status: 200 })
}
