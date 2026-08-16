/**
 * The numeral rule for Teletalk One.
 *
 *   Quantities  — amounts, counts, dates, timers  → Bengali digits in bn, Latin in en.
 *   Identifiers — MSISDN, NID, SIM serial, txn ID,
 *                 POS code, OTP                   → ALWAYS Latin, in every locale.
 *
 * Identifiers stay Latin because they are copied, dictated over the phone, and
 * matched against BVS, CBS, DMS and ERP — none of which speak Bengali digits.
 *
 * Every component must go through these functions. Never call
 * toLocaleString() or template a raw number into JSX directly.
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const

/** Bengali (and Arabic-Indic) digits → Latin. Run on EVERY numeric input. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

/** Latin digits → Bengali. */
export function toBengaliDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])
}

export type Lang = 'bn' | 'en'

/** Quantities: counts, amounts, timers, dates. Localises the digits. */
export function formatQuantity(
  value: number,
  lang: Lang,
  options: Intl.NumberFormatOptions = {},
): string {
  const latin = new Intl.NumberFormat('en-US', options).format(value)
  return lang === 'bn' ? toBengaliDigits(latin) : latin
}

/** Money. Bengali digits in bn, ৳ symbol in both. */
export function formatMoney(value: number, lang: Lang): string {
  const n = formatQuantity(value, lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `৳ ${n}`
}

/* --------------------------------- dates -------------------------------- */

/**
 * Dates are quantities, so they localise — and a localised Bangla date means
 * more than swapped digits: ১৬ আগস্ট ২০২৬, not ১৬ Aug ২০২৬. That needs the
 * locale's own month names, which is why these go through Intl rather than
 * through `formatQuantity`.
 *
 * If the runtime has no Bangla date data (a stripped-ICU build), the fallback
 * gives Latin month names with Bengali digits — degraded, never broken, and
 * never a raw ISO string in front of a retailer.
 */
const DATE_LOCALE: Record<Lang, string> = { bn: 'bn-BD', en: 'en-GB' }

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function intl(lang: Lang, options: Intl.DateTimeFormatOptions, date: Date): string {
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[lang], options).format(date)
  } catch {
    const latin = new Intl.DateTimeFormat('en-GB', options).format(date)
    return lang === 'bn' ? toBengaliDigits(latin) : latin
  }
}

/** 16 Aug 2026 / ১৬ আগস্ট ২০২৬. Empty string for an unparseable value. */
export function formatDate(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  if (!date) return ''
  return intl(lang, { day: 'numeric', month: 'short', year: 'numeric' }, date)
}

/** Wall-clock time. 12-hour, because that is how a counter says it aloud. */
export function formatTime(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  if (!date) return ''
  return intl(lang, { hour: 'numeric', minute: '2-digit', hour12: true }, date)
}

export function formatDateTime(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  if (!date) return ''
  return `${formatDate(date, lang)}, ${formatTime(date, lang)}`
}

/**
 * "Today" and "yesterday" carry more meaning on a ledger than a date does —
 * the retailer's question is almost always "did that one just go through?".
 * Anything older falls back to the date.
 */
export function formatRelativeDay(
  value: string | Date,
  lang: Lang,
  labels: { today: string; yesterday: string },
  now: Date = new Date(),
): string {
  const date = toDate(value)
  if (!date) return ''
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000,
  )
  if (days === 0) return labels.today
  if (days === 1) return labels.yesterday
  return formatDate(date, lang)
}

/* ------------------------------ identifiers ----------------------------- */

/**
 * Identifiers: POS code, MSISDN, NID, SIM serial, transaction ID, OTP.
 * Normalises to Latin digits and strips separators. Never localised.
 */
export function formatIdentifier(value: string): string {
  return toLatinDigits(value).replace(/[\s-]/g, '')
}

/** MSISDN shown to the user, partially masked: +8801714****87 */
export function maskMsisdn(msisdn: string): string {
  const id = formatIdentifier(msisdn)
  if (id.length < 6) return id
  return `${id.slice(0, -6)}${'*'.repeat(4)}${id.slice(-2)}`
}
