import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { assertCanAccessMedia, putChunk } from '@/modules/media'

/** Принимает один кусок файла (`?index=N`), тело — сырые байты. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const { id } = await params
  const index = Number(new URL(request.url).searchParams.get('index'))

  try {
    await assertCanAccessMedia(current.actor, id)
    const body = new Uint8Array(await request.arrayBuffer())
    await putChunk(id, index, body)
    return NextResponse.json({ ok: true, index })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось сохранить часть'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
