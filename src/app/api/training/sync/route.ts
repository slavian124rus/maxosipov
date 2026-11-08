import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { ForbiddenError } from '@/modules/rbac'
import { setExerciseFeeling, syncSets, type SyncSetItem } from '@/modules/training'

const feelingSchema = z.enum(['easy', 'good', 'hard'])

const bodySchema = z.object({
  items: z.array(z.unknown()).max(50).default([]),
  feelings: z
    .array(
      z.object({
        sessionClientUuid: z.string().min(1).max(64),
        exerciseId: z.string().uuid(),
        feeling: feelingSchema,
      }),
    )
    .max(50)
    .default([]),
})

const itemSchema = z.object({
  clientUuid: z.string().min(1).max(64),
  sessionClientUuid: z.string().min(1).max(64),
  exerciseId: z.string().uuid(),
  setIndex: z.number().int().min(1).max(100),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(200),
  feeling: feelingSchema.optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  loggedOffline: z.boolean().default(false),
})

/**
 * Приём подходов из офлайн-очереди. Идемпотентно по `clientUuid`.
 * Отвечает `accepted` (записаны) и `rejected` (непригодны навсегда — клиент их больше не шлёт).
 */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  try {
    await assertClientAccess(current.user.id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  const items: SyncSetItem[] = []
  const rejected: string[] = []

  for (const raw of parsed.data.items) {
    const item = itemSchema.safeParse(raw)

    if (!item.success) {
      const uuid = (raw as { clientUuid?: unknown } | null)?.clientUuid
      if (typeof uuid === 'string') rejected.push(uuid)
      continue
    }

    const { startedAt, finishedAt, feeling, ...rest } = item.data
    items.push({
      ...rest,
      ...(feeling ? { feeling } : {}),
      ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
      ...(finishedAt ? { finishedAt: new Date(finishedAt) } : {}),
    })
  }

  try {
    const result = await syncSets(current.user.id, items)

    for (const feeling of parsed.data.feelings) {
      await setExerciseFeeling(
        current.user.id,
        feeling.sessionClientUuid,
        feeling.exerciseId,
        feeling.feeling,
      )
    }

    return NextResponse.json({
      accepted: result.accepted,
      rejected: [...rejected, ...result.rejected],
    })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
