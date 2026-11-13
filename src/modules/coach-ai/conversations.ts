import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { aiProposals } from '@/modules/training'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
import { aiConversations, aiMessages } from './schema'

const MAX_TITLE = 40
const MESSAGES_LIMIT = 200

/** Запасной заголовок чата: начало первого вопроса, до 40 символов по границе слова. */
export function titleFromText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Новый чат'
  if (clean.length <= MAX_TITLE) return clean

  const cut = clean.slice(0, MAX_TITLE)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 15 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export type ConversationListItem = {
  id: string
  title: string
  lastText: string
  lastAt: Date
  /** В чате есть предложение МаксИИма, которое ждёт решения. */
  hasPending: boolean
}

const normalize = (text: string) => text.toLowerCase().replace(/ё/g, 'е')

/** Чаты клиента для списка: новые сверху, без архивных и пустых. */
export async function listConversations(
  userId: string,
  options: { query?: string } = {},
): Promise<ConversationListItem[]> {
  const conversations = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), isNull(aiConversations.archivedAt)))
    .orderBy(desc(aiConversations.updatedAt))

  if (conversations.length === 0) return []
  const ids = conversations.map((conversation) => conversation.id)

  const [lastMessages, pending] = await Promise.all([
    db
      .selectDistinctOn([aiMessages.conversationId], {
        conversationId: aiMessages.conversationId,
        content: aiMessages.content,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .where(inArray(aiMessages.conversationId, ids))
      .orderBy(aiMessages.conversationId, desc(aiMessages.createdAt)),
    db
      .selectDistinct({ conversationId: aiProposals.conversationId })
      .from(aiProposals)
      .where(
        and(
          eq(aiProposals.userId, userId),
          eq(aiProposals.status, 'pending'),
          inArray(aiProposals.conversationId, ids),
        ),
      ),
  ])

  const last = new Map(lastMessages.map((row) => [row.conversationId, row]))
  const withPending = new Set(pending.map((row) => row.conversationId))
  const needle = normalize(options.query?.trim() ?? '')

  return conversations
    .filter((conversation) => last.has(conversation.id))
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title ?? 'Новый чат',
      lastText: last.get(conversation.id)!.content,
      lastAt: last.get(conversation.id)!.createdAt,
      hasPending: withPending.has(conversation.id),
    }))
    .filter((item) => !needle || normalize(item.title).includes(needle))
}

export type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

/** Сообщения чата по порядку; чужой или несуществующий чат — `null`. */
export async function getConversationMessages(
  userId: string,
  conversationId: string,
): Promise<ConversationMessage[] | null> {
  const [conversation] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1)
  if (!conversation) return null

  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content, createdAt: aiMessages.createdAt })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(MESSAGES_LIMIT)

  return rows.reverse()
}

export async function getConversationTitle(userId: string, conversationId: string): Promise<string | null> {
  const [row] = await db
    .select({ title: aiConversations.title })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1)
  return row?.title ?? null
}

/** Ничего не удаляем насовсем: чат уходит в архив. */
export async function archiveConversation(userId: string, conversationId: string): Promise<void> {
  const updated = await db
    .update(aiConversations)
    .set({ archivedAt: new Date() })
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .returning({ id: aiConversations.id })

  if (updated.length === 0) throw new NotFoundError('Чат не найден')
}
