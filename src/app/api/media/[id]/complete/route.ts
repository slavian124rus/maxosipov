import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { assertCanAccessMedia, completeUpload } from '@/modules/media'

/** Завершает загрузку: склеивает куски и ставит задачу обработки. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const { id } = await params

  try {
    await assertCanAccessMedia(current.actor, id)
    await completeUpload(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось завершить загрузку'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
