import { NextResponse } from 'next/server'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { finishSession } from '@/modules/training'

/** Завершение тренировки. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  await assertClientAccess(current.user.id)

  const body = (await request.json().catch(() => null)) as {
    sessionClientUuid?: string
    finishedAt?: string
    comment?: string
  } | null

  if (!body?.sessionClientUuid) {
    return NextResponse.json({ error: 'Нужен sessionClientUuid' }, { status: 400 })
  }

  await finishSession(current.user.id, body.sessionClientUuid, {
    finishedAt: body.finishedAt ? new Date(body.finishedAt) : new Date(),
    ...(body.comment ? { comment: body.comment } : {}),
  })

  return NextResponse.json({ ok: true })
}