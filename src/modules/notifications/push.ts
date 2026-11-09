import { sendNotification, setVapidDetails } from 'web-push'

/** Текст уведомления, который увидит человек. */
export type PushMessage = { title: string; body: string; url: string }

export type PushTarget = {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** `sent` — доставлено, `gone` — подписки больше нет (404/410), `failed` — временная ошибка. */
export type PushResult = 'sent' | 'gone' | 'failed'

export const PUSH_ICON = '/icons/icon-192.png'

/**
 * Ключи читаем из `process.env` в момент отправки: `env` — снимок на старте,
 * а push опционален (без ключей приложение работает, уведомления просто не уходят).
 */
function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null

  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || 'mailto:hello@maxosipov.ru',
  }
}

export function isPushConfigured(): boolean {
  return vapid() !== null
}

let configuredFor: string | null = null

/** Отправляет push на одно устройство. Ошибка 404/410 означает, что подписку пора удалить. */
export async function sendPush(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const keys = vapid()
  if (!keys) return 'failed'

  if (configuredFor !== keys.publicKey) {
    setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
    configuredFor = keys.publicKey
  }

  try {
    await sendNotification(
      { endpoint: target.endpoint, keys: target.keys },
      JSON.stringify({ ...message, icon: PUSH_ICON, badge: PUSH_ICON }),
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'

    console.error('[notifications] push не отправлен', status ?? error)
    return 'failed'
  }
}