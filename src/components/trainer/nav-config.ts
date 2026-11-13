import { can, type Actor } from '@/modules/rbac'
import type { SettingsItem, TrainerNavItem } from '@/components/trainer/nav-items'

/**
 * Списки разделов кабинета по правам (DESIGN.md §8.9). Файл серверный: тянет `rbac`,
 * поэтому клиентские компоненты берут из него только готовые списки через props.
 * На ПК показываем все доступные разделы в боковом меню, на телефоне — пять
 * (`mobileNavItems`), остальное живёт в «Ещё».
 */
export function trainerNavItems(actor: Actor): TrainerNavItem[] {
  const items: (TrainerNavItem | null)[] = [
    {
      href: '/trainer',
      label: 'Сегодня',
      icon: 'today',
      mobile: true,
      hint: 'Что требует внимания',
    },
    can(actor, 'clients.view')
      ? {
          href: '/trainer/clients',
          label: 'Клиенты',
          icon: 'clients',
          mobile: true,
          hint: 'Люди, доступ, прогресс',
        }
      : null,
    can(actor, 'clients.edit_programs')
      ? {
          href: '/trainer/programs',
          label: 'Программы',
          icon: 'programs',
          mobile: true,
          hint: 'Шаблоны и назначение',
        }
      : null,
    can(actor, 'catalog.edit') || can(actor, 'catalog.publish')
      ? {
          href: '/trainer/exercises',
          label: 'Упражнения',
          icon: 'exercises',
          mobile: true,
          hint: 'Каталог по тренажёрам',
        }
      : null,
    can(actor, 'catalog.edit')
      ? {
          href: '/trainer/machines',
          label: 'Тренажёры',
          icon: 'machines',
          hint: 'Фото, зоны, шаг веса',
        }
      : null,
    can(actor, 'subscriptions.grant')
      ? {
          href: '/trainer/subscriptions',
          label: 'Подписки',
          icon: 'subscriptions',
          hint: 'Продлить, заморозить',
        }
      : null,
    { href: '/trainer/settings', label: 'Ещё', icon: 'more', mobile: true, hint: 'Настройки зала' },
  ]

  return items.filter((item): item is TrainerNavItem => item !== null)
}

/** Раздел «Ещё»: на телефоне — список, на ПК — карточки по группам. */
export function settingsNavItems(actor: Actor): SettingsItem[] {
  const items: (SettingsItem | null)[] = [
    can(actor, 'settings.ai')
      ? {
          href: '/trainer/settings/ai',
          label: 'МаксИИм',
          description: 'Памятка, лимиты и расход ИИ',
          group: 'Зал',
        }
      : null,
    can(actor, 'settings.progression')
      ? {
          href: '/trainer/settings/progression',
          label: 'Правила прогрессии',
          description: 'Когда прибавлять вес',
          group: 'Зал',
        }
      : null,
    can(actor, 'catalog.edit') || can(actor, 'catalog.publish')
      ? {
          href: '/trainer/machines',
          label: 'Тренажёры',
          description: 'Фото, зоны, шаг веса',
          group: 'Зал',
        }
      : null,
    can(actor, 'catalog.edit')
      ? {
          href: '/trainer/settings/zones',
          label: 'Зоны тренажёров',
          description: 'Кардио, ноги, спина — дерево каталога',
          group: 'Зал',
        }
      : null,
    can(actor, 'catalog.edit')
      ? {
          href: '/trainer/settings/warmups',
          label: 'Разминки',
          description: 'Что делать перед тренировкой: ноги, верх, всё тело',
          group: 'Зал',
        }
      : null,
    can(actor, 'settings.brand')
      ? {
          href: '/trainer/settings/brand',
          label: 'Бренд',
          description: 'Название, цвета, логотип',
          group: 'Зал',
        }
      : null,
    can(actor, 'settings.brand')
      ? {
          href: '/trainer/settings/contacts',
          label: 'Контакты',
          description: 'Телефон и фото для экрана доступа',
          group: 'Зал',
        }
      : null,
    can(actor, 'analytics.view')
      ? {
          href: '/trainer/settings/stats',
          label: 'Статистика',
          description: 'Клиенты, тренировки, объём',
          group: 'Зал',
        }
      : null,
    can(actor, 'subscriptions.grant')
      ? {
          href: '/trainer/subscriptions',
          label: 'Подписки',
          description: 'Продлить, заморозить, история',
          group: 'Доступ',
        }
      : null,
    can(actor, 'subscriptions.grant')
      ? {
          href: '/trainer/settings/access',
          label: 'Пробный период и цена',
          description: 'Сколько дней и сколько стоит',
          group: 'Доступ',
        }
      : null,
    can(actor, 'users.assign_roles')
      ? {
          href: '/trainer/settings/people',
          label: 'Люди',
          description: 'Кто в кабинете и с какой ролью',
          group: 'Люди',
        }
      : null,
    can(actor, 'roles.manage')
      ? {
          href: '/trainer/settings/roles',
          label: 'Роли и права',
          description: 'Что кому можно',
          group: 'Люди',
        }
      : null,
    can(actor, 'roles.manage')
      ? {
          href: '/trainer/settings/audit',
          label: 'Журнал',
          description: 'Изменения прав и доступа',
          group: 'Люди',
        }
      : null,
  ]

  return items.filter((item): item is SettingsItem => item !== null)
}
