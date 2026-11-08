import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { ForbiddenError } from '@/modules/rbac'
import { setNextWeight } from '@/modules/training'

const bodySchema = z.object({
  exerciseId: z.string().uuid(),
  weightKg: z.number().min(0).max(1000),
})

/** «В следующий раз» — вес, который клиент принял после упражнения. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    await assertClientAccess(current.user.id)
    await setNextWeight(current.user.id, parsed.data.exerciseId, parsed.data.weightKg)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
