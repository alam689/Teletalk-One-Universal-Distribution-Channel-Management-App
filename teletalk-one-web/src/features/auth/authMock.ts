import { ApiError } from '../../lib/http'
import { PASSWORD_POLICY, type PasswordPolicy } from './authTypes'
import type { IdentityResult, SignInResult } from './authApi'
import { findAccount, sessionFor } from './demoAccounts'

/**
 * In-repo mock of the auth service. Active only when VITE_API_BASE_URL is
 * unset. Error `detail` values map 1:1 onto `error.*` i18n keys, exactly as the
 * real service must.
 *
 * One account per role lives in demoAccounts.ts, so every capability set in the
 * org model can be signed into and reviewed.
 */

export const policy: PasswordPolicy = PASSWORD_POLICY

const INACTIVE_POS = '20060795'
const DEMO_OTP = '123456'
const MAX_ATTEMPTS = 5
const SESSION_POS = 'teletalk.mock.pos'
const SESSION_TRUST = 'teletalk.mock.trusted'

let demoPassword = 'Tele@1234'
let failedAttempts = 0

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function lookupPos(posCode: string): Promise<IdentityResult> {
  await delay(500)
  if (posCode === INACTIVE_POS) throw new ApiError('forbidden', 403, 'posInactive')
  const account = findAccount(posCode)
  if (!account) throw new ApiError('notFound', 404, 'posUnknown')
  return { msisdn: account.session.msisdn, deviceTrusted: false }
}

export async function verifyPassword(posCode: string, password: string): Promise<void> {
  await delay(600)
  if (failedAttempts >= MAX_ATTEMPTS) throw new ApiError('forbidden', 403, 'locked')
  if (!findAccount(posCode) || password !== demoPassword) {
    failedAttempts += 1
    if (failedAttempts >= MAX_ATTEMPTS) throw new ApiError('forbidden', 403, 'locked')
    const err = new ApiError('unauthorized', 401, 'passwordWrong')
    // Attempts remaining travels as a typed field, not inside a message string.
    ;(err as ApiError & { attemptsLeft?: number }).attemptsLeft = MAX_ATTEMPTS - failedAttempts
    throw err
  }
  failedAttempts = 0
}

export async function requestOtp(_posCode: string): Promise<void> {
  await delay(400)
}

const tokens = () => ({ accessToken: 'mock-access-token', expiresIn: 900 })

export async function verifyOtp(
  posCode: string,
  otp: string,
  trustDevice: boolean,
): Promise<SignInResult> {
  await delay(700)
  if (otp !== DEMO_OTP) throw new ApiError('unauthorized', 401, 'otpWrong')
  const account = findAccount(posCode)
  if (!account) throw new ApiError('notFound', 404, 'posUnknown')
  try {
    sessionStorage.setItem(SESSION_POS, posCode)
    sessionStorage.setItem(SESSION_TRUST, trustDevice ? '1' : '')
  } catch {
    /* storage unavailable — session simply won't survive reload */
  }
  return { session: sessionFor(account, trustDevice), tokens: tokens() }
}

/**
 * Stands in for the httpOnly refresh cookie. Only the POS code is stored —
 * never the session object, which carries outlet, MSISDN and address.
 */
export async function restoreSession(): Promise<SignInResult | null> {
  await delay(150)
  let posCode: string | null = null
  let trusted = false
  try {
    posCode = sessionStorage.getItem(SESSION_POS)
    trusted = sessionStorage.getItem(SESSION_TRUST) === '1'
  } catch {
    return null
  }
  if (!posCode) return null
  const account = findAccount(posCode)
  if (!account) return null
  return { session: sessionFor(account, trusted), tokens: tokens() }
}

export async function signOut(): Promise<void> {
  await delay(150)
  try {
    sessionStorage.removeItem(SESSION_POS)
    sessionStorage.removeItem(SESSION_TRUST)
  } catch {
    /* ignore */
  }
  failedAttempts = 0
}

export async function changePassword(current: string, next: string): Promise<void> {
  await delay(800)
  if (current !== demoPassword) throw new ApiError('unauthorized', 401, 'currentPasswordWrong')
  if (next === demoPassword) throw new ApiError('conflict', 409, 'passwordReused')
  demoPassword = next
}

/** Test hook — resets module state between cases. */
export function __resetMock(): void {
  demoPassword = 'Tele@1234'
  failedAttempts = 0
  try {
    sessionStorage.removeItem(SESSION_POS)
    sessionStorage.removeItem(SESSION_TRUST)
  } catch {
    /* ignore */
  }
}
