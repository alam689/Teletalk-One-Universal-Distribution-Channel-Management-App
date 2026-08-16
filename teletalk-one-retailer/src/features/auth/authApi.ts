import { env } from '../../env'
import { ApiError, call, setAccessToken } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import * as mock from './authMock'

export type { Capability, Role, Session, Bilingual, PasswordPolicy } from './authTypes'
export { PASSWORD_POLICY } from './authTypes'

import type { PasswordPolicy, Session } from './authTypes'

export interface IdentityResult {
  msisdn: string
  /** True when this device was trusted within the trust window. */
  deviceTrusted: boolean
}

export interface AuthTokens {
  accessToken: string
  /** Seconds until the access token expires. */
  expiresIn: number
}

export interface SignInResult {
  session: Session
  tokens: AuthTokens
}

/* ------------------------------------------------------------------ *
 * The mock exists so the UI can be built and tested before the BVS/CBS
 * contracts are frozen. `env.useMockApi` is false the moment
 * API_BASE_URL is set, and a production build without it logs loudly.
 * ------------------------------------------------------------------ */

export async function lookupPos(posCode: string, signal?: AbortSignal): Promise<IdentityResult> {
  if (env.useMockApi) return mock.lookupPos(posCode)
  return call<IdentityResult>(API_ROUTES.authIdentity, { body: { posCode }, signal })
}

export async function verifyPassword(
  posCode: string,
  password: string,
  signal?: AbortSignal,
): Promise<void> {
  if (env.useMockApi) return mock.verifyPassword(posCode, password)
  await call<void>(API_ROUTES.authPassword, { body: { posCode, password }, signal })
}

export async function requestOtp(posCode: string, signal?: AbortSignal): Promise<void> {
  if (env.useMockApi) return mock.requestOtp(posCode)
  await call<void>(API_ROUTES.authOtp, { body: { posCode }, signal })
}

export async function verifyOtp(
  posCode: string,
  otp: string,
  trustDevice: boolean,
  signal?: AbortSignal,
): Promise<SignInResult> {
  if (env.useMockApi) return mock.verifyOtp(posCode, otp, trustDevice)
  const result = await call<SignInResult>(API_ROUTES.authVerify, {
    body: { posCode, otp, trustDevice },
    signal,
  })
  setAccessToken(result.tokens.accessToken)
  return result
}

/**
 * Called once on app boot. The refresh token lives in an httpOnly cookie, so
 * this is what survives a page reload — never a session object in localStorage.
 * Returns null when there is no valid session, which is not an error.
 */
export async function restoreSession(signal?: AbortSignal): Promise<SignInResult | null> {
  try {
    const result = env.useMockApi
      ? await mock.restoreSession()
      : await call<SignInResult>(API_ROUTES.authSession, { signal })
    if (result) setAccessToken(result.tokens.accessToken)
    return result
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'unauthorized' || err.code === 'notFound')) {
      return null
    }
    throw err
  }
}

/**
 * Proactive refresh. Returns tokens only — never a session — so a refresh
 * cannot quietly change who the client thinks it is signed in as.
 */
export async function refreshTokens(signal?: AbortSignal): Promise<AuthTokens> {
  const result = env.useMockApi
    ? await mock.refreshTokens()
    : await call<AuthTokens>(API_ROUTES.authRefresh, { retries: 0, signal })
  setAccessToken(result.accessToken)
  return result
}

export async function signOut(): Promise<void> {
  try {
    if (env.useMockApi) await mock.signOut()
    else await call<void>(API_ROUTES.authSignOut, { retries: 0 })
  } finally {
    // Local state is cleared even if the server call fails — the user asked to
    // leave, and a shared counter terminal must not stay signed in.
    setAccessToken(null)
  }
}

export async function changePassword(
  current: string,
  next: string,
  signal?: AbortSignal,
): Promise<void> {
  if (env.useMockApi) return mock.changePassword(current, next)
  await call<void>(API_ROUTES.accountPassword, {
    body: { currentPassword: current, newPassword: next },
    signal,
  })
}

export function passwordPolicy(): PasswordPolicy {
  return mock.policy
}
