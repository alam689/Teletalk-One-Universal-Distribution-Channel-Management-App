import Constants from 'expo-constants'

/**
 * Typed, validated config. Read it through this module only — a stray
 * `process.env.X` typo silently becomes `undefined` at runtime.
 *
 * Values come from `app.json`'s `extra` block, which is where Expo puts
 * per-build configuration. `EXPO_PUBLIC_*` environment variables override them,
 * which is what a CI build sets. Nothing secret belongs in either: both are
 * readable in the shipped bundle, and an API key in `extra` is an API key
 * published to every handset that installs the app.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>

function str(key: string, fallback = ''): string {
  const fromEnv = process.env[`EXPO_PUBLIC_${key}`]
  const value = fromEnv ?? extra[key]
  return typeof value === 'string' ? value.trim() : fallback
}

function num(key: string, fallback: number, min: number): number {
  const raw = process.env[`EXPO_PUBLIC_${key}`] ?? extra[key]
  const n = Number(raw)
  return Number.isFinite(n) && n >= min ? n : fallback
}

const apiBaseUrl = str('API_BASE_URL').replace(/\/+$/, '')

export const env = {
  apiBaseUrl,
  /** No API configured → run against the in-repo mock. Never true in a store build. */
  useMockApi: apiBaseUrl === '',
  /**
   * 30 seconds, against the portal's 20. A handset on a 2G handover in a rural
   * bazaar is slow rather than dead, and a request abandoned early becomes a
   * retailer pressing the button a second time.
   */
  apiTimeoutMs: num('API_TIMEOUT_MS', 30_000, 5_000),
  /**
   * The portal signs out after 15 idle minutes because a counter PC is shared
   * and walked away from. A handset is personal and locked by the OS, so the
   * window is longer — but it is not absent: this app can activate a SIM
   * against a customer's NID, and a phone left on a shop counter is exactly the
   * risk the portal's timeout was written for.
   */
  idleTimeoutMs: num('IDLE_TIMEOUT_MIN', 30, 1) * 60_000,
  isDev: __DEV__,
  isProd: !__DEV__,
} as const

if (env.isProd && env.useMockApi) {
  // Loud, because shipping the mock to a retailer would be severe.
  console.error('[teletalk-one] API_BASE_URL is not set — this build runs against the mock API.')
}
