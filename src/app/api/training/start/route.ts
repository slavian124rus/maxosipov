import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { ForbiddenError } from '@/modules/rbac'
import { startSession } from '@/modules/training'

const bodySchema = z.object({
  clientUuid: z.string().min(1).max(64),
  programDayId: z.string().uuid().nullable().optional(),
  mode: z.enum(['free', 'guided']).default('free'),
  startedAt: z.string().datetime().optional(),
})

/** Старт тренировки с клиента. Идемпотентно по `clientUuid`. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    await assertClientAccess(current.user.id)

    const { sessionId } = await startSession(current.user.id, {
      programDayId: parsed.data.programDayId ?? null,
      mode: parsed.data.mode,
      clientUuid: parsed.data.clientUuid,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
    })

    return NextResponse.json({ sessionId })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
