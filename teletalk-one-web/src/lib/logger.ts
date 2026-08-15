import { env } from '../env'

/**
 * Single funnel for diagnostics. Two reasons it exists rather than bare
 * console calls:
 *
 *  1. Retailer screens show customer MSISDN, NID and transaction data. Console
 *     output on a shared counter terminal is a disclosure risk, so debug and
 *     info are compiled out of production.
 *  2. `reportError` is the one place to attach Sentry/App Insights later
 *     without touching call sites.
 */

type Extra = Record<string, unknown>

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

  /** Always reported. Wire the crash reporter in here. */
  error(message: string, error?: unknown, extra?: Extra): void {
    console.error(`[teletalk] ${message}`, error ?? '', extra ?? '')
  },
}
