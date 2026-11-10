import { env } from '@/shared/env'

const TELEGRAM_TIMEOUT_MS = 5000

export type TelegramMessage = { token: string; chatId: string; text: string }

/**
 * Отправка в Telegram Bot API (`sendMessage`). Без `parse_mode`: имя вводит посетитель,
 * разметка из него не должна исполняться. Токен лежит только в адресе запроса и не попадает
 * в тексты ошибок (в логах и отчётах его быть не должно).
 */
export async function sendTelegramMessage({ token, chatId, text }: TelegramMessage): Promise<void> {
  let response: Response
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message.split(token).join('<token>') : 'сбой сети'
    throw new Error(`Telegram недоступен: ${reason}`)
  }

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null
  if (!response.ok || payload?.ok !== true) {
    throw new Error(`Telegram не принял сообщение: ${payload?.description ?? `HTTP ${response.status}`}`)
  }
}

/** Текст заявки для группы тренера. */
export function formatLeadMessage(lead: { name: string; phone: string }): string {
  return `Новая заявка с сайта\nИмя: ${lead.name}\nТелефон: ${lead.phone}`
}

/** Заданы ли токен бота и чат для заявок. */
export function isTelegramLeadsConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_LEADS_CHAT_ID)
}

/**
 * Дублирует заявку в Telegram-группу. Не настроено — молча ничего не делает
 * (dev и тесты). Ошибки пробрасывает наружу, решает вызывающий.
 */
export async function notifyLeadInTelegram(lead: { name: string; phone: string }): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_LEADS_CHAT_ID
  if (!token || !chatId) return

  await sendTelegramMessage({ token, chatId, text: formatLeadMessage(lead) })
}
