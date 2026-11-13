import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { ForbiddenError } from '@/modules/rbac'
import { finishSession } from '@/modules/training'

const bodySchema = z.object({
  sessionClientUuid: z.string().min(1).max(64),
  finishedAt: z.string().datetime().optional(),
  comment: z.string().max(1000).optional(),
  warmupStatus: z.enum(['done', 'skipped']).optional(),
})

/** Завершение тренировки. Повторный вызов безопасен. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    await assertClientAccess(current.user.id)

    await finishSession(current.user.id, parsed.data.sessionClientUuid, {
      finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : new Date(),
      ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
      ...(parsed.data.warmupStatus ? { warmupStatus: parsed.data.warmupStatus } : {}),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    // сессии на сервере ещё нет (старт не дошёл) — клиент повторит
    if (error instanceof Error && error.message === 'Тренировка не найдена') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
