import { env } from '../env'

/**
 * Single funnel for diagnostics. Two reasons it exists rather than bare
 * console calls:
 *
 *  1. Retailer screens show customer MSISDN, NID and transaction data. Console
 *     output on a shared counter terminal is a disclosure risk, so debug and
 *     info are compiled out of production.
 *  2. `logger.error` is the one place a crash reporter attaches, and it does
 *     so through `setCrashReporter` rather than by editing call sites.
 */

type Extra = Record<string, unknown>

export interface CrashReport {
  message: string
  error?: unknown
  extra?: Extra
  at: string
}

export type CrashReporter = (report: CrashReport) => void

let reporter: CrashReporter | null = null

/**
 * Attach Sentry, App Insights, or anything else. Call it once at boot.
 *
 * Nothing is attached by default and that is deliberate: shipping a reporter
 * that phones a third party from a retailer's device is a decision for
 * Teletalk to make explicitly, not a default someone inherits.
 */
export function setCrashReporter(fn: CrashReporter | null): void {
  reporter = fn
}

/* ------------------------------ scrubbing ------------------------------ */

/**
 * A crash report leaves the device. Everything this app handles that could
 * identify a person is a run of digits, so the scrubber works on shape rather
 * than on field names — a field name only helps when the value is where you
 * expected it, and in a stack trace or an error message it never is.
 *
 * Ordered longest-first so a 17-digit NID is not first mangled as an 11-digit
 * MSISDN with six digits trailing.
 */
const SENSITIVE = [
  { pattern: /\b\d{17}\b/g, label: '[nid]' },
  { pattern: /\b\d{13}\b/g, label: '[nid]' },
  { pattern: /\b89\d{17,18}\b/g, label: '[iccid]' },
  { pattern: /\b01\d{9}\b/g, label: '[msisdn]' },
  { pattern: /\b\d{10}\b/g, label: '[nid]' },
] as const

export function scrub(value: string): string {
  return SENSITIVE.reduce((text, { pattern, label }) => text.replace(pattern, label), value)
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]'
  if (typeof value === 'string') return scrub(value)
  if (value instanceof Error) {
    return { name: value.name, message: scrub(value.message), stack: scrub(value.stack ?? '') }
  }
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Extra).map(([k, v]) => [k, scrubDeep(v, depth + 1)]),
    )
  }
  return value
}

export const logger = {
  debug(message: string, extra?: Extra): void {
    if (!env.isDev) return
    // eslint-disable-next-line no-console
    console.debug(`[teletalk] ${message}`, extra ?? '')
  },

  warn(message: string, extra?: Extra): void {
    if (!env.isDev) return
    // eslint-disable-next-line no-console
    console.warn(`[teletalk] ${message}`, extra ?? '')
  },

  /** Always reported, always scrubbed, and never allowed to throw. */
  error(message: string, error?: unknown, extra?: Extra): void {
    console.error(`[teletalk] ${message}`, error ?? '', extra ?? '')
    if (!reporter) return
    try {
      reporter({
        message: scrub(message),
        error: scrubDeep(error),
        extra: scrubDeep(extra) as Extra | undefined,
        at: new Date().toISOString(),
      })
    } catch {
      /* a broken reporter must never take the app down with it */
    }
  },
}
