/** Задачи ИИ, для которых в админке выбирается модель (ARCHITECTURE.md §9). */
export const AI_TASKS = [
  { task: 'chat', kind: 'main', label: 'Чат МаксИИма', hint: 'Ответы клиентам и предложения по тренировкам' },
  { task: 'templates', kind: 'templates', label: 'Шаблоны программ', hint: 'Черновики и проверка шаблонов в кабинете' },
  { task: 'exercises', kind: 'exercises', label: 'Карточки упражнений', hint: 'Черновики текстов и проверка карточек' },
  { task: 'quick', kind: 'fast', label: 'Быстрая модель', hint: 'Итоги тренировок, голосовой ввод, стартовые веса, названия чатов' },
  { task: 'fallback', kind: 'fallback', label: 'Запасная модель', hint: 'Включается, если основная не ответила' },
] as const

export type AiTask = (typeof AI_TASKS)[number]['task']
export type AiTaskKind = (typeof AI_TASKS)[number]['kind']
