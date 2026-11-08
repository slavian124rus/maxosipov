import { NextResponse } from 'next/server'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { startSession } from '@/modules/training'

/** Старт тренировки с клиента. Идемпотентно по `clientUuid`. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  await assertClientAccess(current.user.id)

  const body = (await request.json().catch(() => null)) as {
    clientUuid?: string
    programDayId?: string | null
    mode?: 'free' | 'guided'
    startedAt?: string
  } | null

  if (!body?.clientUuid) {
    return NextResponse.json({ error: 'Нужен clientUuid' }, { status: 400 })
  }

  const { sessionId } = await startSession(current.user.id, {
    programDayId: body.programDayId ?? null,
    mode: body.mode === 'guided' ? 'guided' : 'free',
    clientUuid: body.clientUuid,
    startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
  })

  return NextResponse.json({ sessionId })
}