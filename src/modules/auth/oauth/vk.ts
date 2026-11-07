import { env } from '@/shared/env'
import { normalizePhone } from '../phone'
import type { OAuthProfile } from './yandex'

const VK_AUTHORIZE = 'https://id.vk.ru/authorize'
const VK_TOKEN = 'https://id.vk.com/oauth2/auth'
const VK_USER_INFO = 'https://id.vk.com/oauth2/user_info'

type VkTokenResponse = { access_token?: string; error?: string; error_description?: string }
type VkUserInfoResponse = {
  user?: {
    user_id?: string | number
    first_name?: string
    last_name?: string
    phone?: string
  }
  error?: string
  error_description?: string
}

function parseVkProfile(payload: VkUserInfoResponse): OAuthProfile {
  const user = payload.user
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')

  return {
    providerUserId: String(user?.user_id ?? ''),
    phone: user?.phone ? normalizePhone(user.phone) : null,
    name: name || null,
  }
}

export type VkExchangeInput = {
  code: string
  verifier: string
  redirectUri: string
  deviceId: string | null
  state: string
}

/** VK ID (OAuth 2.1 + PKCE) по документации https://id.vk.com/about/business/go/docs/ru/vkid */
export const vk = {
  isConfigured: () => Boolean(env.VK_CLIENT_ID && env.VK_CLIENT_SECRET),

  authorizeUrl(state: string, challenge: string, redirectUri: string): string {
    const url = new URL(VK_AUTHORIZE)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', env.VK_CLIENT_ID ?? '')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'phone')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  },

  async exchange(input: VkExchangeInput): Promise<OAuthProfile> {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.verifier,
      redirect_uri: input.redirectUri,
      client_id: env.VK_CLIENT_ID ?? '',
      client_secret: env.VK_CLIENT_SECRET ?? '',
      state: input.state,
    })
    if (input.deviceId) tokenBody.set('device_id', input.deviceId)

    const tokenResponse = await fetch(VK_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })

    const token = (await tokenResponse.json()) as VkTokenResponse
    if (!token.access_token) {
      throw new Error(`VK ID не выдал токен: ${token.error_description ?? token.error ?? 'unknown'}`)
    }

    const infoResponse = await fetch(VK_USER_INFO, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.VK_CLIENT_ID ?? '',
        access_token: token.access_token,
      }),
    })

    return parseVkProfile((await infoResponse.json()) as VkUserInfoResponse)
  },

  parseProfile: parseVkProfile,
}
