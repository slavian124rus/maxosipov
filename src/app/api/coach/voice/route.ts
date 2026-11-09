import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { detectFlag, getSpeechToText, PAIN_REPLY, parseVoiceLog } from '@/modules/coach-ai'
import { getHeadTrainerId } from '@/modules/gym'
import { notify } from '@/modules/notifications'
import { ForbiddenError } from '@/modules/rbac'
import { programExercises, setLogs, workoutSessions } from '@/modules/training'
import { db } from '@/shared/db'

const MAX_BYTES = 10 * 1024 * 1024

async function sessionExercises(
  userId: string,
  sessionClientUuid: string,
): Promise<{ id: string; name: string }[]> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(
      and(eq(workoutSessions.userId, userId), eq(workoutSessions.clientUuid, sessionClientUuid)),
    )
    .limit(1)

  if (!session) throw new ForbiddenError('Тренировка не найдена')

  const ids = new Set<string>()

  if (session.programDayId) {
    const rows = await db
      .select({ id: programExercises.exerciseId })
      .from(programExercises)
      .where(eq(programExercises.dayId, session.programDayId))
    for (const row of rows) ids.add(row.id)
  }

  const logged = await db
    .select({ id: setLogs.exerciseId })
    .from(setLogs)
    .where(eq(setLogs.sessionId, session.id))
  for (const row of logged) ids.add(row.id)

  if (ids.size === 0) return []

  const rows = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(eq(exercises.status, 'published'))

  return rows.filter((row) => ids.has(row.id))
}

/** Голосовой отчёт: распознать, разобрать по упражнениям тренировки, вернуть таблицу «Проверь». */
export async function POST(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const audio = form?.get('audio')
  if (!form || !(audio instanceof File)) {
    return NextResponse.json({ error: 'Нет аудио' }, { status: 400 })
  }

  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Запись больше 10 МБ' }, { status: 400 })
  }

  const rawSession = form.get('sessionClientUuid')
  const sessionClientUuid = typeof rawSession === 'string' && rawSession ? rawSession : null

  try {
    await assertClientAccess(current.user.id)

    const dir = await mkdtemp(path.join(tmpdir(), 'voice-'))
    const filePath = path.join(dir, 'voice')
    await writeFile(filePath, Buffer.from(await audio.arrayBuffer()))

    let text = ''

    try {
      text = await getSpeechToText().transcribe({
        path: filePath,
        mime: audio.type || 'audio/webm',
      })
    } finally {
      // Аудио удаляется сразу после распознавания (ARCHITECTURE.md §9.7).
      await rm(dir, { recursive: true, force: true })
    }

    // Диктовка в чат: без тренировки возвращаем только текст.
    if (!sessionClientUuid) {
      return NextResponse.json({ text, rows: [], flag: detectFlag(text), reply: null })
    }

    const list = await sessionExercises(current.user.id, sessionClientUuid)
    const parsed = await parseVoiceLog(text, list)

    if (parsed.flag) {
      const trainerId = current.user.trainerId ?? (await getHeadTrainerId())
      if (trainerId) {
        await notify(trainerId, 'client_pain', {
          clientId: current.user.id,
          flag: parsed.flag,
          text,
        })
      }
    }

    return NextResponse.json({
      text,
      rows: parsed.rows,
      flag: parsed.flag,
      reply: parsed.flag ? PAIN_REPLY : null,
    })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : 'Не удалось распознать'
    if (message.includes('не настроено') || message.includes('SpeechKit') || message.includes('Распознавание')) {
      return NextResponse.json({ error: message }, { status: 503 })
    }

    console.error('[coach-ai] голос', error)
    return NextResponse.json({ error: 'Не удалось распознать' }, { status: 500 })
  }
}