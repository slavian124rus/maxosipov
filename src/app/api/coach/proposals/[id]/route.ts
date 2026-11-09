import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/modules/auth'
import { acceptProposal, rejectProposal } from '@/modules/coach-ai'
import { ForbiddenError } from '@/modules/rbac'

const bodySchema = z.object({ action: z.enum(['accept', 'reject']) })

/** «Принять» / «Не надо» для предложения МаксИИма. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  const { id } = await context.params

  try {
    if (parsed.data.action === 'accept') await acceptProposal(current.actor, id)
    else await rejectProposal(current.actor, id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'Не удалось применить'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}