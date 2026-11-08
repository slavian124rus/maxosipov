import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { mediaRoot, safeJoin, verifyMediaRequest } from '@/modules/media'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.mov': 'video/quicktime',
}

/**
 * Раздача медиа в разработке (в продакшене это делает Caddy после `forward_auth`).
 * Подпись проверяется так же, как в `/api/media/auth`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const { path: segments } = await params
  const relPath = segments.join('/')

  if (relPath.split('/').includes('..')) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const url = new URL(request.url)
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''

  if (!verifyMediaRequest(relPath, exp, sig)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let file: string
  try {
    file = safeJoin(mediaRoot(), relPath)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }

  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  const range = request.headers.get('range')

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match) {
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Number(match[2]) : size - 1
      const safeEnd = Math.min(end, size - 1)

      if (start <= safeEnd) {
        const data = await readFile(file)
        const chunk = data.subarray(start, safeEnd + 1)
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'content-type': type,
            'content-length': String(chunk.length),
            'content-range': `bytes ${start}-${safeEnd}/${size}`,
            'accept-ranges': 'bytes',
            'cache-control': 'private, max-age=21600',
          },
        })
      }
    }
  }

  const data = await readFile(file)
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'content-type': type,
      'content-length': String(size),
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=21600',
    },
  })
}
