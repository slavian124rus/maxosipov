import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { env } from '@/shared/env'
import { resolveSurface } from '@/shared/surface'

/**
 * Сайт индексируется целиком, приложение — нет (план, задача 4):
 * внутренние пути `/app/*` запрещены, а на хосте `app.*` закрыто всё.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host')

  if (resolveSurface(host) === 'app') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/api'] }],
    sitemap: `${env.SITE_URL}/sitemap.xml`,
    // Директива Host — это домен без схемы (требование Яндекса).
    host: new URL(env.SITE_URL).host,
  }
}
