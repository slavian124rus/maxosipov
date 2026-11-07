import { env } from '@/shared/env'
import { normalizePhone } from '../phone'

/** Нормализованный профиль от провайдера. */
export type OAuthProfile = {
  providerUserId: string
  phone: string | null
  name: string | null
}

export type OAuthClient = {
  isConfigured(): boolean
  authorizeUrl(state: string, challenge: string, redirectUri: string): string
  exchange(code: string, verifier: string, redirectUri: string): Promise<OAuthProfile>
}

const YANDEX_AUTHORIZE = 'https://oauth.yandex.ru/authorize'
const YANDEX_TOKEN = 'https://oauth.yandex.ru/token'
const YANDEX_INFO = 'https://login.yandex.ru/info?format=json'

type YandexTokenResponse = { access_token?: string; error?: string; error_description?: string }
type YandexInfoResponse = {
  id?: string
  real_name?: string
  display_name?: string
  default_phone?: { number?: string }
}

function parseYandexProfile(info: YandexInfoResponse): OAuthProfile {
  const rawPhone = info.default_phone?.number
  return {
    providerUserId: String(info.id ?? ''),
    phone: rawPhone ? normalizePhone(rawPhone) : null,
    name: info.real_name ?? info.display_name ?? null,
  }
}

/** Яндекс ID по документации https://yandex.ru/dev/id/doc/ru/ */
export const yandex: OAuthClient & { parseProfile: typeof parseYandexProfile } = {
  isConfigured: () => Boolean(env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET),

  authorizeUrl(state, challenge, redirectUri) {
    const url = new URL(YANDEX_AUTHORIZE)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', env.YANDEX_CLIENT_ID ?? '')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'login:info login:default_phone')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  },

  async exchange(code, verifier, redirectUri) {
    const tokenResponse = await fetch(YANDEX_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env.YANDEX_CLIENT_ID ?? '',
        client_secret: env.YANDEX_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    })

    const token = (await tokenResponse.json()) as YandexTokenResponse
    if (!token.access_token) {
      throw new Error(`Яндекс ID не выдал токен: ${token.error_description ?? token.error ?? 'unknown'}`)
    }

    const infoResponse = await fetch(YANDEX_INFO, {
      headers: { Authorization: `OAuth ${token.access_token}` },
    })

    return parseYandexProfile((await infoResponse.json()) as YandexInfoResponse)
  },

  parseProfile: parseYandexProfile,
}
