/**
 * Чистая часть навигации кабинета: типы и хелперы без прав и без БД.
 * Файл импортируют клиентские компоненты (боковое и нижнее меню), поэтому
 * `@/modules/rbac` здесь быть не должно — иначе драйвер БД уедет в браузер.
 * Списки пунктов по правам — в `nav-config.ts` (только сервер).
 */

/** Иконки бокового меню и нижней навигации кабинета. */
export type TrainerNavIcon =
  | 'today'
  | 'clients'
  | 'programs'
  | 'exercises'
  | 'machines'
  | 'subscriptions'
  | 'more'

export type TrainerNavItem = {
  href: string
  label: string
  icon: TrainerNavIcon
  /** Пункт нужен и в нижнем меню телефона (там помещается не больше пяти). */
  mobile?: boolean
  /** Подпись для бокового меню на ПК — одна строка, зачем раздел. */
  hint?: string
}

/** Пункты нижнего меню телефона: не больше пяти, порядок как в `trainerNavItems`. */
export function mobileNavItems(items: TrainerNavItem[]): TrainerNavItem[] {
  return items.filter((item) => item.mobile).slice(0, 5)
}

/** Активен ли пункт меню для текущего адреса. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/trainer') return pathname === '/trainer'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type SettingsGroup = 'Зал' | 'Доступ' | 'Люди'

export type SettingsItem = {
  href: string
  label: string
  description: string
  group: SettingsGroup
}

/** Группы раздела «Ещё» в порядке показа; пустые группы не попадают. */
export function settingsGroups(
  items: SettingsItem[],
): { title: SettingsGroup; items: SettingsItem[] }[] {
  const order: SettingsGroup[] = ['Зал', 'Доступ', 'Люди']

  return order
    .map((title) => ({ title, items: items.filter((item) => item.group === title) }))
    .filter((group) => group.items.length > 0)
}
