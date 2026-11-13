import { and, desc, eq, isNull } from 'drizzle-orm'
import { stepCountIs, streamText, type LanguageModel } from 'ai'
import { getAccessForUser, NO_ACCESS_MESSAGE } from '@/modules/access'
import type { CurrentUser } from '@/modules/auth'
import { getGym, getHeadTrainerId } from '@/modules/gym'
import { notify } from '@/modules/notifications'
import { ForbiddenError } from '@/modules/rbac'
import { db } from '@/shared/db'
import { buildContextBlock, loadContextData } from './context'
import { buildPainBlock, isRepeatComplaint, loadPainState, mentionsClearance, painZones } from './pain'
import { MISSING_DRAFT_NOTICE, needsMissingDraftNotice } from './claims'
import { detectFlag, PAIN_REPLY } from './flags'
import { buildSystemPrompt } from './prompt'
import {
  AiUnavailableError,
  getModel,
  getModelName,
  refreshModelOverrides,
  withFallback,
  type ModelKind,
} from './provider'
import { aiConversations, aiMessages } from './schema'
import { titleFromText } from './conversations'
import { createCoachTools } from './tools'
import { recordUsage, releaseMessage, reserveMessage } from './usage'

/** Тексты состояний чата (DESIGN.md §8.6). */
export const LIMIT_REPLY =
  'На сегодня вопросы закончились — продолжим завтра. Дневник и подсказки по весам работают'
export const UNAVAILABLE_REPLY = 'МаксИИм сейчас недоступен. Дневник и подсказки по весам работают'

export const COACH_CONVERSATION_HEADER = 'x-coach-conversation-id'

export type ChatDeps = {
  getModel?: (kind: ModelKind) => LanguageModel
  modelName?: string
  timeoutMs?: number
  now?: Date
}

function textResponse(text: string, conversationId: string | null): Response {
  const headers: Record<string, string> = { 'content-type': 'text/plain; charset=utf-8' }
  if (conversationId) headers[COACH_CONVERSATION_HEADER] = conversationId

  return new Response(text, { headers })
}

async function resolveConversation(userId: string, conversationId: string | null): Promise<string> {
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
      .limit(1)

    if (!existing) throw new ForbiddenError('Это чужой диалог')
    return existing.id
  }

  const [created] = await db
    .insert(aiConversations)
    .values({ userId })
    .returning({ id: aiConversations.id })
  if (!created) throw new Error('Диалог не создан')
  return created.id
}

type SavedMessage = {
  conversationId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  flagged?: 'pain' | 'injury' | null
  toolCalls?: unknown
  tokensIn?: number
  tokensOut?: number
  model?: string | null
}

async function saveMessage(input: SavedMessage): Promise<void> {
  await db.insert(aiMessages).values({
    conversationId: input.conversationId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    flagged: input.flagged ?? null,
    toolCalls: input.toolCalls ?? null,
    tokensIn: input.tokensIn ?? 0,
    tokensOut: input.tokensOut ?? 0,
    model: input.model ?? null,
  })

  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, input.conversationId))

  // Заголовок чата — начало первого вопроса; быстрая модель может уточнить его позже.
  if (input.role === 'user') {
    await db
      .update(aiConversations)
      .set({ title: titleFromText(input.content) })
      .where(and(eq(aiConversations.id, input.conversationId), isNull(aiConversations.title)))
  }
}

async function historyMessages(
  conversationId: string,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(20)

  return rows.reverse()
}
export type ChatHistory = {
  conversationId: string | null
  messages: { role: 'user' | 'assistant'; content: string }[]
}

/** Последний диалог клиента для восстановления экрана после перезагрузки. */
export async function getChatHistory(userId: string): Promise<ChatHistory> {
  const [conversation] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(1)

  if (!conversation) return { conversationId: null, messages: [] }

  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversation.id))
    .orderBy(desc(aiMessages.createdAt))
    .limit(20)

  return { conversationId: conversation.id, messages: rows.reverse() }
}

/**
 * Ответ МаксИИма: доступ → лимит → флаг боли → модель с инструментами и стримингом.
 * Возвращает текстовый поток; в заголовке — id диалога для карточек предложений.
 */
export async function handleChatMessage(
  user: CurrentUser,
  conversationId: string | null,
  text: string,
  deps: ChatDeps = {},
): Promise<Response> {
  const access = await getAccessForUser(user.user.id)
  if (!access.hasAccess && !access.bypass) throw new ForbiddenError(NO_ACCESS_MESSAGE)

  const gym = await getGym()
  const conversation = await resolveConversation(user.user.id, conversationId)
  const now = deps.now ?? new Date()

  // Боль и травма обрабатываются раньше лимита: Максим должен узнать о ней всегда.
  const painState = await loadPainState(user.user.id, now)
  let flag = detectFlag(text)

  // «Максим посмотрел, всё ок» — это не новая жалоба.
  if (flag && painState.recentlyResolved.length > 0 && mentionsClearance(text)) flag = null

  if (flag) {
    const zones = painZones(text)

    await saveMessage({
      conversationId: conversation,
      userId: user.user.id,
      role: 'user',
      content: text,
      flagged: flag,
    })

    // По зоне с уже открытой жалобой Максима повторно не беспокоим.
    if (!isRepeatComplaint(painState, zones)) {
      const trainerId = user.user.trainerId ?? (await getHeadTrainerId())
      if (trainerId) {
        await notify(trainerId, 'client_pain', {
          name: user.user.name,
          text,
          clientId: user.user.id,
        })
      }
    }
    painState.zones = [...new Set([...painState.zones, ...zones])]
  }

  // Слот занимается атомарно до вызова модели: параллельные запросы не обходят лимит.
  const reserved = await reserveMessage(user.user.id, gym.settings.aiDailyLimit, now, gym.timezone)

  if (!reserved) {
    if (flag) {
      await saveMessage({
        conversationId: conversation,
        userId: user.user.id,
        role: 'assistant',
        content: PAIN_REPLY,
      })
      return textResponse(PAIN_REPLY, conversation)
    }
    return textResponse(LIMIT_REPLY, conversation)
  }

  if (!flag) {
    await saveMessage({
      conversationId: conversation,
      userId: user.user.id,
      role: 'user',
      content: text,
    })
  }

  const data = await loadContextData(user.user.id)
  const painBlock = buildPainBlock(painState)
  const system = `${buildSystemPrompt(gym.settings.aiMemo)}\n\n${buildContextBlock(data, gym.timezone)}${painBlock ? `\n\n${painBlock}` : ''}`
  const messages = await historyMessages(conversation)
  const tools = createCoachTools({
    userId: user.user.id,
    conversationId: conversation,
    program: data.program,
    pain: painState,
  })
  if (!deps.getModel) await refreshModelOverrides()
  const modelName = deps.modelName ?? getModelName('main')
  const resolveModel = deps.getModel ?? getModel
  const timeoutMs = deps.timeoutMs ?? 30_000

  try {
    const opened = await withFallback(
      async (model) => {
        const result = streamText({
          model,
          system,
          messages,
          tools,
          stopWhen: stepCountIs(6),
        })

        const iterator = result.textStream[Symbol.asyncIterator]()
        const first = await iterator.next()
        return { iterator, first, result }
      },
      'main',
      { getModel: resolveModel, timeoutMs },
    )

    const encoder = new TextEncoder()
    const { iterator, first, result } = opened

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (flag) controller.enqueue(encoder.encode(`${PAIN_REPLY}\n\n`))
          if (!first.done && first.value) controller.enqueue(encoder.encode(first.value))
          for (;;) {
            const chunk = await iterator.next()
            if (chunk.done) break
            controller.enqueue(encoder.encode(chunk.value))
          }
        } catch (error) {
          console.error('[coach-ai] поток ответа прервался', error)
        }

        try {
          let answer = flag ? `${PAIN_REPLY}\n\n${await result.text}` : await result.text
          const usage = await result.usage
          const steps = await result.steps
          const toolCalls = steps.flatMap((step) =>
            step.toolCalls.map((call) => ({ name: call.toolName, input: call.input })),
          )
          const toolResults = steps.flatMap((step) =>
            step.toolResults.map((item) => ({ toolName: item.toolName, output: item.output })),
          )

          // Пообещал «нажми Принять», а предложения нет — честно говорим об этом.
          if (needsMissingDraftNotice(answer, toolResults)) {
            const notice = `\n\n${MISSING_DRAFT_NOTICE}`
            controller.enqueue(encoder.encode(notice))
            answer += notice
          }

          const tokensIn = usage.inputTokens ?? 0
          const tokensOut = usage.outputTokens ?? 0

          await saveMessage({
            conversationId: conversation,
            userId: user.user.id,
            role: 'assistant',
            content: answer,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            tokensIn,
            tokensOut,
            model: modelName,
          })

          await recordUsage(
            user.user.id,
            { model: modelName, tokensIn, tokensOut, countsTowardLimit: false },
            { now, timeZone: gym.timezone, prices: gym.settings.aiPrices },
          )
        } catch (error) {
          console.error('[coach-ai] не удалось сохранить ответ', error)
        }

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        [COACH_CONVERSATION_HEADER]: conversation,
      },
    })
  } catch (error) {
    await releaseMessage(user.user.id, now, gym.timezone).catch(() => undefined)
    if (error instanceof AiUnavailableError) {
      // Жалоба на боль не остаётся без ответа, даже если модель недоступна.
      return textResponse(flag ? PAIN_REPLY : UNAVAILABLE_REPLY, conversation)
    }
    throw error
  }
}
