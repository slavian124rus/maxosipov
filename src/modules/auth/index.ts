export { authAccounts, sessions, users } from './schema'
export type { AuthAccount, AuthProvider, NewUser, Session, User } from './schema'

export { formatPhone, normalizePhone } from './phone'

export {
  createSession,
  destroySession,
  SESSION_COOKIE,
  sessionCookieOptions,
  validateSessionToken,
} from './session'
export type { CreatedSession, ValidatedSession } from './session'

export { getCurrentUser, requireUser } from './current'
export type { CurrentUser } from './current'

export { otpText, requestOtp, verifyOtp } from './otp'
export type { RequestOtpResult, VerifyOtpResult } from './otp'

export { otpCodes } from './schema'
export type { OtpCode } from './schema'

export { getSmsProvider } from './sms'
export type { SmsProvider } from './sms/types'

export { signInWithVerifiedPhone } from './signin'
export type { SignInLink, SignInResult } from './signin'

export { cleanupPendingLinks, createPendingLink, takePendingLink } from './pending-link'

export { createPkce } from './oauth/pkce'
export type { Pkce } from './oauth/pkce'

export { openState, sealState, OAUTH_COOKIE, oauthCookieOptions } from './oauth/state'
export type { OAuthState } from './oauth/state'

export { yandex } from './oauth/yandex'
export type { OAuthClient, OAuthProfile } from './oauth/yandex'

export { vk } from './oauth/vk'
export type { VkExchangeInput } from './oauth/vk'

export { pendingLinks } from './schema'
export type { PendingLink } from './schema'

export { clientProfileSchema } from './profile-schema'
export type { ClientProfileInput } from './profile-schema'

export { saveOnboarding } from './profile'

export { clientProfiles } from './schema'
export type { ClientExperience, ClientGoal, ClientProfile, ClientSex } from './schema'






