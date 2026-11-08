import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { createUpload, type MediaKind } from '@/modules/media'

// Фото включим на этапе 3 вместе с квотой на клиента.
const KINDS: MediaKind[] = ['exercise_video']

/** Создаёт загрузку: возвращает id, размер куска и число кусков. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  let body: { kind?: string; fileName?: string; sizeBytes?: number; mime?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })
  }

  const kind = body.kind as MediaKind
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Неизвестный тип' }, { status: 400 })

  try {
    const created = await createUpload(current.actor, {
      kind,
      fileName: body.fileName ?? '',
      sizeBytes: Number(body.sizeBytes ?? 0),
      mime: body.mime ?? '',
    })
    return NextResponse.json(created)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать загрузку'
    const status = message.includes('прав') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
