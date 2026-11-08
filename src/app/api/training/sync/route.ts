import { NextResponse } from 'next/server'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { syncSets, setExerciseFeeling, type SyncSetItem } from '@/modules/training'

type Body = {
  items?: {
    clientUuid?: string
    sessionClientUuid?: string
    exerciseId?: string
    setIndex?: number
    weightKg?: number
    reps?: number
    feeling?: 'easy' | 'good' | 'hard'
    startedAt?: string
    finishedAt?: string
    loggedOffline?: boolean
  }[]
  feelings?: { sessionClientUuid?: string; exerciseId?: string; feeling?: 'easy' | 'good' | 'hard' }[]
}

/** Приём подходов из офлайн-очереди. Идемпотентно по `clientUuid`. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  await assertClientAccess(current.user.id)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })
  }

  const items: SyncSetItem[] = (body.items ?? []).map((item) => ({
    clientUuid: String(item.clientUuid ?? ''),
    sessionClientUuid: String(item.sessionClientUuid ?? ''),
    exerciseId: String(item.exerciseId ?? ''),
    setIndex: Number(item.setIndex ?? 0),
    weightKg: Number(item.weightKg ?? 0),
    reps: Number(item.reps ?? 0),
    ...(item.feeling ? { feeling: item.feeling } : {}),
    ...(item.startedAt ? { startedAt: new Date(item.startedAt) } : {}),
    ...(item.finishedAt ? { finishedAt: new Date(item.finishedAt) } : {}),
    loggedOffline: Boolean(item.loggedOffline),
  }))

  const feelings = (body.feelings ?? []).filter(
    (item) => item.sessionClientUuid && item.exerciseId && item.feeling,
  )

  if (items.length > 50) {
    return NextResponse.json({ error: 'Не больше 50 подходов за раз' }, { status: 400 })
  }
  if (items.length === 0 && feelings.length === 0) {
    return NextResponse.json({ error: 'Нужно от 1 до 50 подходов' }, { status: 400 })
  }

  try {
    const { accepted } = await syncSets(current.user.id, items)

    for (const feeling of body.feelings ?? []) {
      if (!feeling.sessionClientUuid || !feeling.exerciseId || !feeling.feeling) continue
      await setExerciseFeeling(
        current.user.id,
        feeling.sessionClientUuid,
        feeling.exerciseId,
        feeling.feeling,
      )
    }

    return NextResponse.json({ accepted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось сохранить подходы'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}