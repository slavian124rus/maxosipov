import { NextResponse } from 'next/server'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { setNextWeight } from '@/modules/training'

/** «В следующий раз» — вес, который клиент принял после упражнения. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  await assertClientAccess(current.user.id)

  const body = (await request.json().catch(() => null)) as {
    exerciseId?: string
    weightKg?: number
  } | null

  if (!body?.exerciseId || typeof body.weightKg !== 'number') {
    return NextResponse.json({ error: 'Нужны exerciseId и weightKg' }, { status: 400 })
  }

  await setNextWeight(current.user.id, body.exerciseId, body.weightKg)
  return NextResponse.json({ ok: true })
}