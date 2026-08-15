/**
 * Typed, validated environment access. Read config through this module only —
 * a stray `import.meta.env.X` typo silently becomes `undefined` at runtime.
 */

function num(raw: string | undefined, fallback: number, min: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min ? n : fallback
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const env = {
  apiBaseUrl,
  /** No API configured → run against the in-repo mock. Never true in a real build. */
  useMockApi: apiBaseUrl === '',
  apiTimeoutMs: num(import.meta.env.VITE_API_TIMEOUT_MS, 20_000, 5_000),
  idleTimeoutMs: num(import.meta.env.VITE_IDLE_TIMEOUT_MIN, 15, 1) * 60_000,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
} as const

if (env.isProd && env.useMockApi) {
  // Loud, because shipping the mock to a retailer counter would be severe.
  console.error(
    '[teletalk-one] VITE_API_BASE_URL is not set — the build is running against the mock API.',
  )
}
