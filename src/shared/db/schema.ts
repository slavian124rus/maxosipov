/**
 * Единственный файл, которому разрешён прямой импорт `schema.ts` модулей.
 * Наружу (в `@/shared/db`) схемы отдаются отсюда.
 */
export * from '@/modules/gym/schema'
export * from '@/modules/auth/schema'
export * from '@/modules/rbac/schema'
export * from '@/modules/access/schema'
export * from '@/modules/catalog/schema'
export * from '@/modules/media/schema'
export * from '@/modules/training/schema'
export * from '@/modules/body/schema'
export * from '@/modules/coach-ai/schema'
export * from '@/modules/notifications/schema'
export * from '@/modules/trainer/schema'
export * from '@/modules/landing/schema'
