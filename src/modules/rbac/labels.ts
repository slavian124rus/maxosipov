import type { Permission } from './permissions'

export type PermissionGroup = 'Клиенты' | 'Подписки' | 'Контент' | 'Настройки' | 'Система'

/** Подписи прав на русском для всего интерфейса (задача 6 этапа 5). */
export const PERMISSION_LABELS: Record<Permission, { group: PermissionGroup; label: string }> = {
  'clients.view': { group: 'Клиенты', label: 'Видеть клиентов' },
  'clients.edit_programs': { group: 'Клиенты', label: 'Менять программы' },
  'clients.view_photos': { group: 'Клиенты', label: 'Видеть фото „до/после“' },
  'clients.view_ai_flags': { group: 'Клиенты', label: 'Видеть жалобы и предложения МаксИИма' },
  'clients.notes': { group: 'Клиенты', label: 'Писать заметки' },
  'clients.measurements': { group: 'Клиенты', label: 'Вносить замеры' },
  'subscriptions.grant': { group: 'Подписки', label: 'Выдавать и продлевать подписки' },
  'subscriptions.pricing': { group: 'Подписки', label: 'Менять цену и длительность пробного' },
  'catalog.edit': { group: 'Контент', label: 'Добавлять упражнения и тренажёры' },
  'catalog.publish': { group: 'Контент', label: 'Публиковать упражнения' },
  'settings.ai': { group: 'Настройки', label: 'Настройки МаксИИма и расходы' },
  'settings.progression': { group: 'Настройки', label: 'Правила прогрессии весов' },
  'settings.brand': { group: 'Настройки', label: 'Бренд и контакты' },
  'users.assign_roles': { group: 'Система', label: 'Назначать роли людям' },
  'roles.manage': { group: 'Система', label: 'Управлять ролями' },
  'analytics.view': { group: 'Система', label: 'Смотреть статистику' },
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  'Клиенты',
  'Подписки',
  'Контент',
  'Настройки',
  'Система',
]