export { authAccounts, sessions, users } from './schema'
export type { AuthAccount, AuthProvider, NewUser, Session, User } from './schema'

export { formatContact, formatPhone, normalizePhone } from './phone'

export {
  createSession,
  destroySession,
  SESSION_COOKIE,
  cookieDomainFor,
  sessionCookieOptions,
  validateSessionToken,
} from './session'
export type { CreatedSession, ValidatedSession } from './session'

export { getCurrentUser, requireUser } from './current'
export type { CurrentUser } from './current'

export { emailOtpMessage, otpText, requestEmailOtp, requestOtp, verifyEmailOtp, verifyOtp } from './otp'
export type { RequestEmailOtpResult, RequestOtpResult, VerifyOtpResult } from './otp'
export { canonicalEmail, normalizeEmail } from './email'
export { getEmailProvider } from './mail'
export type { EmailMessage, EmailProvider } from './mail'

export { otpCodes } from './schema'
export type { OtpCode } from './schema'

export { getSmsProvider } from './sms'
export type { SmsProvider } from './sms/types'

export { signInWithVerifiedEmail, signInWithVerifiedPhone } from './signin'
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

export { saveOnboarding, getClientProfile } from './profile'

export { clientProfiles } from './schema'
export type { ClientExperience, ClientGoal, ClientProfile, ClientSex } from './schema'






export { cleanupAuth } from './cleanup'
export type { AuthCleanupResult } from './cleanup'
