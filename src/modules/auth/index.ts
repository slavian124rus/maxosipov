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




