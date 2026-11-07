/**
 * Единственный файл, которому разрешён прямой импорт `schema.ts` модулей.
 * Наружу (в `@/shared/db`) схемы отдаются отсюда.
 */
export * from '@/modules/gym/schema'
export * from '@/modules/auth/schema'
export * from '@/modules/rbac/schema'
