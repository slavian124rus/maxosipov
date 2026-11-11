import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Полотно кабинета: на телефоне — прежние отступы 16 px, на ПК — просторные поля
 * и ограничение по ширине, чтобы строки не растягивались на весь монитор.
 */
export function TrainerPage({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={`mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-6 lg:gap-6 lg:px-10 lg:py-8 ${className}`}
    >
      {children}
    </main>
  )
}

/**
 * Страница настроек: то же полотно кабинета, заголовок с возвратом в «Ещё»
 * и ограничение ширины — формы не растягиваются на весь монитор.
 */
export function SettingsPage({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <TrainerPage>
      <PageHeader
        back={{ href: '/trainer/settings', label: 'Ещё' }}
        title={title}
        description={description}
      />
      <div className="flex w-full max-w-[760px] flex-col gap-5">{children}</div>
    </TrainerPage>
  )
}

/** Заголовок экрана: надзаголовок, название, пояснение и действия справа (на ПК). */
export function PageHeader({
  title,
  eyebrow,
  description,
  back,
  actions,
}: {
  title: string
  eyebrow?: string
  description?: string
  back?: { href: string; label: string }
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        {back ? (
          <Link
            href={back.href}
            className="mb-1 flex w-fit items-center gap-1 text-[13px] text-text-muted hover:text-text"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="text-[13px] text-text-muted">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold lg:text-[26px]">{title}</h1>
        {description ? (
          <p className="text-[15px] text-text-secondary">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Карточка-секция: на ПК даёт одинаковые отступы и заголовок с действием справа. */
export function Panel({
  title,
  action,
  children,
  tone,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  tone?: 'danger'
  className?: string
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-card border bg-surface-1 px-4 py-4 lg:px-5 ${
        tone === 'danger' ? 'border-danger/40' : 'border-border'
      } ${className}`}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2
            className={`text-[17px] font-semibold ${tone === 'danger' ? 'text-danger' : 'text-text'}`}
          >
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}
