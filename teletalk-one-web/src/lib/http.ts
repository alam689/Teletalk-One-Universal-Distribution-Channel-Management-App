import { env } from '../env'

/**
 * Every failure the UI can encounter, as a stable code. The server sends codes,
 * never prose — prose cannot be translated and cannot be switched on.
 */
export type ApiErrorCode =
  | 'offline'
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'rateLimited'
  | 'server'
  | 'generic'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status = 0,
    /** Server-supplied domain code, e.g. `posInactive`. Maps onto `error.*` keys. */
    public detail?: string,
    /** Seconds to wait, from Retry-After, when the server rate-limited us. */
    public retryAfter?: number,
  ) {
    super(detail ?? code)
    this.name = 'ApiError'
  }
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rateLimited'
  if (status >= 500) return 'server'
  return 'generic'
}

/** Only idempotent reads and genuinely transient failures are retried. */
function isRetryable(err: unknown, method: string): boolean {
  if (method !== 'GET') return false
  if (!(err instanceof ApiError)) return false
  return err.code === 'timeout' || err.code === 'network' || err.code === 'server'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Caller-owned cancellation, composed with the internal timeout. */
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  headers?: Record<string, string>
}

let accessToken: string | null = null

/** Kept in memory only. Never localStorage — XSS there is a token exfiltration. */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

let onUnauthorized: (() => void) | null = null

/** Registered by the auth provider so a 401 anywhere ends the session once. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    signal,
    timeoutMs = env.apiTimeoutMs,
    retries = method === 'GET' ? 2 : 0,
    headers = {},
  } = options

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline')
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs)

    // Caller cancellation must also abort the in-flight request.
    const onCallerAbort = () => timeoutController.abort()
    signal?.addEventListener('abort', onCallerAbort)

    try {
      const res = await fetch(`${env.apiBaseUrl}${path}`, {
        method,
        signal: timeoutController.signal,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const retryAfter = Number(res.headers.get('Retry-After')) || undefined
        const err = new ApiError(
          codeForStatus(res.status),
          res.status,
          typeof payload?.code === 'string' ? payload.code : undefined,
          retryAfter,
        )
        if (err.code === 'unauthorized') onUnauthorized?.()
        throw err
      }

      if (res.status === 204) return undefined as T
      return (await res.json()) as T
    } catch (err) {
      // Distinguish "caller cancelled" from "we timed out" — the first must not
      // surface as an error to the user at all.
      if (signal?.aborted) throw new ApiError('generic')

      lastError =
        err instanceof ApiError
          ? err
          : err instanceof DOMException && err.name === 'AbortError'
            ? new ApiError('timeout')
            : new ApiError('network')

      if (attempt < retries && isRetryable(lastError, method)) {
        // Exponential backoff with jitter, so a zonal outage doesn't produce a
        // synchronised retry stampede from every retailer at once.
        const base = 400 * 2 ** attempt
        await sleep(base + Math.random() * base)
        continue
      }
      throw lastError
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onCallerAbort)
    }
  }

  throw lastError instanceof ApiError ? lastError : new ApiError('generic')
}

/** Maps any thrown value onto an `error.*` i18n key. */
export function errorKey(err: unknown): string {
  if (err instanceof ApiError) return `error.${err.detail ?? err.code}`
  return 'error.generic'
}
