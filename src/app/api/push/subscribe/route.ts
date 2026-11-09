import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { subscribePush, unsubscribePush, type PushSubscriptionJSON } from '@/modules/notifications'

/** Подписка устройства на push. Разрешение спрашивает только кнопка в интерфейсе. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { subscription?: PushSubscriptionJSON } | null
  const subscription = body?.subscription
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    await subscribePush(current.user.id, subscription, request.headers.get('user-agent'))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось подписаться' },
      { status: 400 },
    )
  }
}

/** Отписка устройства (человек выключил уведомления). */
export async function DELETE(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const endpoint = new URL(request.url).searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  await unsubscribePush(current.user.id, endpoint)
  return NextResponse.json({ ok: true })
}