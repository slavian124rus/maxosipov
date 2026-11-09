import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/modules/auth'
import { handleChatMessage } from '@/modules/coach-ai'
import { ForbiddenError } from '@/modules/rbac'

const bodySchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  text: z.string().trim().min(1).max(2000),
})

/** Сообщение МаксИИму. Ответ приходит текстовым потоком. */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    return await handleChatMessage(
      current,
      parsed.data.conversationId ?? null,
      parsed.data.text,
    )
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[coach-ai] чат', error)
    return NextResponse.json({ error: 'Не удалось ответить' }, { status: 500 })
  }
}