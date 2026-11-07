import { afterEach, expect, test, vi } from 'vitest'
import { vk } from './vk'
import { yandex } from './yandex'

function mockFetch(responses: unknown[]): void {
  const fetchMock = vi.fn(async () => {
    const body = responses.shift()
    return { json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('Яндекс: телефон и имя из профиля', async () => {
  mockFetch([
    { access_token: 'token' },
    { id: '123', real_name: 'Иван Петров', default_phone: { number: '79161234567' } },
  ])

  const profile = await yandex.exchange('code', 'verifier', 'http://localhost/cb')

  expect(profile).toEqual({
    providerUserId: '123',
    phone: '+79161234567',
    name: 'Иван Петров',
  })
})

test('Яндекс без телефона → phone: null', async () => {
  mockFetch([{ access_token: 'token' }, { id: '123', display_name: 'ivan' }])

  const profile = await yandex.exchange('code', 'verifier', 'http://localhost/cb')

  expect(profile.phone).toBeNull()
  expect(profile.name).toBe('ivan')
})

test('Яндекс без токена → ошибка', async () => {
  mockFetch([{ error: 'invalid_grant', error_description: 'неверный код' }])

  await expect(yandex.exchange('code', 'verifier', 'http://localhost/cb')).rejects.toThrow(
    /неверный код/,
  )
})

test('VK: телефон и имя из профиля', async () => {
  mockFetch([
    { access_token: 'token' },
    {
      user: {
        user_id: '42',
        first_name: 'Иван',
        last_name: 'Петров',
        phone: '79161234567',
      },
    },
  ])

  const profile = await vk.exchange({
    code: 'code',
    verifier: 'verifier',
    redirectUri: 'http://localhost/cb',
    deviceId: 'device',
    state: 'state',
  })

  expect(profile).toEqual({
    providerUserId: '42',
    phone: '+79161234567',
    name: 'Иван Петров',
  })
})

test('VK без телефона → phone: null', async () => {
  mockFetch([{ access_token: 'token' }, { user: { user_id: '42', first_name: 'Иван' } }])

  const profile = await vk.exchange({
    code: 'code',
    verifier: 'verifier',
    redirectUri: 'http://localhost/cb',
    deviceId: null,
    state: 'state',
  })

  expect(profile.phone).toBeNull()
  expect(profile.name).toBe('Иван')
})

test('VK без токена → ошибка', async () => {
  mockFetch([{ error: 'invalid_client', error_description: 'приложение не найдено' }])

  await expect(
    vk.exchange({
      code: 'code',
      verifier: 'verifier',
      redirectUri: 'http://localhost/cb',
      deviceId: null,
      state: 'state',
    }),
  ).rejects.toThrow(/приложение не найдено/)
})

test('authorizeUrl содержит PKCE и redirect_uri', () => {
  const url = new URL(yandex.authorizeUrl('st', 'ch', 'http://app.localhost:3000/cb'))
  expect(url.origin + url.pathname).toBe('https://oauth.yandex.ru/authorize')
  expect(url.searchParams.get('code_challenge')).toBe('ch')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('state')).toBe('st')

  const vkUrl = new URL(vk.authorizeUrl('st', 'ch', 'http://app.localhost:3000/cb'))
  expect(vkUrl.searchParams.get('scope')).toBe('phone')
  expect(vkUrl.searchParams.get('code_challenge')).toBe('ch')
})
