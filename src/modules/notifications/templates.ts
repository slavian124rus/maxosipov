import { formatLongDate } from '@/shared/dates'
import type { NotificationData, NotificationKind } from './schema'

export type RenderedNotification = { title: string; body: string; url: string; push: boolean }

const SHORT_TEXT = 80

/** «7 декабря» — дата окончания пробного периода в тексте уведомления. */
function trialDate(value: string | undefined, timeZone: string): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return formatLongDate(date, timeZone)
}

function clip(text: string | undefined): string {
  return (text ?? '').trim().slice(0, SHORT_TEXT)
}

/**
 * Тексты уведомлений — ровно из плана этапа 5 (задача 1).
 * `push: false` — событие только в приложении (лента тренера).
 */
export function renderNotification(
  kind: NotificationKind,
  data: NotificationData = {},
  options: { timeZone?: string; now?: Date } = {},
): RenderedNotification {
  const timeZone = options.timeZone ?? 'Asia/Krasnoyarsk'

  switch (kind) {
    case 'sub_ends_3d':
      return {
        title: 'Подписка заканчивается',
        body: 'Осталось 3 дня. Продли у Максима, чтобы не прерываться',
        url: '/profile',
        push: true,
      }

    case 'sub_ended':
      return {
        title: 'Подписка закончилась',
        body: 'Продли у Максима — и продолжаем',
        url: '/paywall',
        push: true,
      }

    case 'program_updated':
      return {
        title: 'Максим обновил программу',
        body: 'Загляни перед тренировкой',
        url: '/workouts',
        push: true,
      }

    case 'client_pain':
      return {
        title: `${data.name ?? 'Клиент'}: жалоба на боль`,
        body: clip(data.text),
        url: `/trainer/clients/${data.clientId ?? ''}?tab=coach`,
        push: true,
      }

    case 'ai_change_accepted':
      return {
        title: `${data.name ?? 'Клиент'} принял изменение МаксИИма`,
        body: clip(data.line),
        url: `/trainer/clients/${data.clientId ?? ''}?tab=program`,
        push: false,
      }

    case 'new_client':
      return {
        title: 'Новый клиент',
        body: `${data.name ?? 'Клиент'}, пробный период до ${trialDate(data.trialUntil, timeZone)}`,
        url: `/trainer/clients/${data.clientId ?? ''}`,
        push: true,
      }

    case 'new_lead':
      return {
        title: 'Заявка с сайта',
        body: `${data.name ?? 'Без имени'}, ${data.phone ?? 'без телефона'}`,
        url: '/trainer/leads',
        push: true,
      }

    case 'trainer_daily': {
      const expiring = data.expiring ?? 0
      const pain = data.pain ?? 0

      return {
        title: 'Сводка на сегодня',
        body: `Заканчивается доступ: ${expiring}. Жалоб: ${pain}`,
        url: '/trainer',
        // Пустую сводку не отправляем (план, задача 1).
        push: expiring > 0 || pain > 0,
      }
    }
  }
}