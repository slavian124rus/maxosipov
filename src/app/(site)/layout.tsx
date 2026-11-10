import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { PersonJsonLd } from '@/components/landing/json-ld'
import { env } from '@/shared/env'

/**
 * Канонический адрес сайта. На лендинге он зашивается в HTML при сборке, поэтому
 * `SITE_URL` проброшен в образ как build-arg (`docker/Dockerfile`, `docker/compose.yml`)
 * с боевым значением по умолчанию — иначе в prerender попал бы `localhost`.
 */
const SITE_ORIGIN = env.SITE_URL

const TITLE = 'Максим Осипов — персональный тренер в Красноярске | Колизей, Говорова'

const DESCRIPTION =
  'Тренировки с Максимом Осиповым в зале «Колизей» на Говорова: персональная программа, видео упражнений, ИИ-помощник МаксИИм. Первый месяц бесплатно.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: TITLE,
    template: '%s · Максим Осипов',
  },
  description: DESCRIPTION,
  applicationName: 'Максим Осипов',
  // SEO под «персональный тренер Красноярск» (план, задача 4).
  keywords: [
    'персональный тренер Красноярск',
    'тренер Колизей Говорова',
    'Максим Осипов',
    'МаксИИм',
    'тренировки в зале Красноярск',
    'приложение для тренировок с тренером',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE_ORIGIN,
    siteName: 'Максим Осипов',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/landing/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Максим Осипов — персональный тренер в Красноярске, зал «Колизей» на Говорова',
      },
    ],
  },
  robots: { index: true, follow: true },
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PersonJsonLd siteUrl={SITE_ORIGIN} description={DESCRIPTION} />
      {children}
    </div>
  )
}
