import { env } from './env'

/**
 * Абсолютный адрес внутри приложения от `APP_URL`, а не от адреса запроса:
 * за Caddy в standalone-режиме `request.url` может быть `http://0.0.0.0:3000/…` (ревью F4).
 */
export function appUrl(path: string, base: string = env.APP_URL): URL {
  return new URL(path, base.endsWith('/') ? base : `${base}/`)
}

/** Адрес кабинета: `app.maxosipov.ru` → `admin.maxosipov.ru` (ARCHITECTURE.md §4). */
export function adminUrl(path: string = '/', base: string = env.APP_URL): URL {
  const url = appUrl(path, base)
  url.hostname = url.hostname.replace(/^app\./i, 'admin.')
  return url
}
