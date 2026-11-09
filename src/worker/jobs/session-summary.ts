import { summarizeSession } from '@/modules/coach-ai'

/** Очередь `session.summary`: итог МаксИИма после завершения тренировки. */
export async function sessionSummaryJob(data: { sessionId: string }): Promise<void> {
  await summarizeSession(data.sessionId)
}