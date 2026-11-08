import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { assertCanAccessMedia, getMediaStatus } from '@/modules/media'

/** Статус загрузки: `received_chunks` нужны клиенту для докачки. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const { id } = await params

  try {
    await assertCanAccessMedia(current.actor, id)
    const status = await getMediaStatus(id)
    return NextResponse.json({
      id: status.id,
      status: status.status,
      received_chunks: status.receivedChunks,
      total_chunks: status.totalChunks,
      error: status.error,
    })
  } catch {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }
}
