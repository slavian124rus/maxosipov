import { expect, test } from 'vitest'
import { decideRoute } from './guard'

const base = { hasSession: true, onboardingDone: true, hasAccess: true, bypass: false }

test('без сессии — на /login', () => {
  expect(decideRoute({ ...base, hasSession: false, path: '/' })).toEqual({ redirect: '/login' })
})

test('с сессией без анкеты — на /onboarding', () => {
  expect(decideRoute({ ...base, onboardingDone: false, path: '/' })).toEqual({
    redirect: '/onboarding',
  })
})

test('без доступа на /exercises — на /paywall', () => {
  expect(decideRoute({ ...base, hasAccess: false, path: '/exercises' })).toEqual({
    redirect: '/paywall',
  })
})

test('без доступа история и профиль доступны', () => {
  expect(decideRoute({ ...base, hasAccess: false, path: '/progress' })).toEqual({ allow: true })
  expect(decideRoute({ ...base, hasAccess: false, path: '/profile' })).toEqual({ allow: true })
})

test('без доступа настройки открыты, а «Мой план» — нет', () => {
  expect(decideRoute({ ...base, hasAccess: false, path: '/settings' })).toEqual({ allow: true })
  expect(decideRoute({ ...base, hasAccess: false, path: '/plan' })).toEqual({
    redirect: '/paywall',
  })
})

test('bypass пускает везде', () => {
  expect(decideRoute({ ...base, bypass: true, hasAccess: false, path: '/exercises' })).toEqual({
    allow: true,
  })
  expect(
    decideRoute({ ...base, bypass: true, onboardingDone: false, path: '/exercises' }),
  ).toEqual({ allow: true })
})

test('на /paywall с доступом — на главную', () => {
  expect(decideRoute({ ...base, path: '/paywall' })).toEqual({ redirect: '/' })
})

test('на /paywall без доступа — остаёмся', () => {
  expect(decideRoute({ ...base, hasAccess: false, path: '/paywall' })).toEqual({ allow: true })
})

test('с доступом — везде пускает', () => {
  expect(decideRoute({ ...base, path: '/exercises' })).toEqual({ allow: true })
})
