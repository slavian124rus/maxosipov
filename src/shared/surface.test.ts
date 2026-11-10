import { expect, test } from 'vitest'
import { resolveSurface, rewriteTarget } from './surface'

test.each([
  ['maxosipov.ru', 'site'],
  ['www.maxosipov.ru', 'site'],
  ['MAXOSIPOV.RU', 'site'],
  ['app.maxosipov.ru', 'app'],
  ['APP.maxosipov.ru:443', 'app'],
  ['localhost:3000', 'site'],
  ['app.localhost:3000', 'app'],
  ['admin.maxosipov.ru', 'admin'],
  ['ADMIN.maxosipov.ru:443', 'admin'],
  ['admin.localhost:3000', 'admin'],
  [null, 'site'],
])('%s -> %s', (host, expected) => {
  expect(resolveSurface(host as string | null)).toBe(expected)
})

test.each([
  ['app', '/workouts', '/app/workouts'],
  ['app', '/app/workouts', '/404'],
  ['app', '/app/exercises', '/404'],
  ['app', '/app', '/404'],
  ['app', '/trainer', '/404'],
  ['app', '/trainer/clients', '/404'],
  ['app', '/offline', '/app/offline'],
  ['app', '/sw.js', null],
  ['app', '/manifest.webmanifest', null],
  ['app', '/icons/icon-192.png', null],
  ['app', '/figure/front.svg', null],
  ['app', '/media/2026/11/x/video.mp4', null],
  ['app', '/api/health', null],
  ['app', '/_next/static/chunk.js', null],
  ['admin', '/', '/app/trainer'],
  ['admin', '/trainer', '/app/trainer'],
  ['admin', '/trainer/clients/42', '/app/trainer/clients/42'],
  ['admin', '/login', '/app/login'],
  ['admin', '/login/email/code', '/app/login/email/code'],
  ['admin', '/legal/privacy', '/app/legal/privacy'],
  ['admin', '/workouts', '/404'],
  ['admin', '/exercises', '/404'],
  ['admin', '/app/trainer', '/404'],
  ['admin', '/api/health', null],
  ['admin', '/sw.js', null],
  ['admin', '/media/x/video.mp4', null],
  ['site', '/app/x', '/404'],
  ['site', '/', null],
])('%s %s -> %s', (surface, pathname, expected) => {
  expect(rewriteTarget(surface as 'site' | 'app' | 'admin', pathname)).toBe(expected)
})
