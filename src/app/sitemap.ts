import type { MetadataRoute } from 'next'
import { env } from '@/shared/env'

/** Только главная и юридические страницы сайта (план, задача 4). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.SITE_URL
  const now = new Date()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/consent`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
