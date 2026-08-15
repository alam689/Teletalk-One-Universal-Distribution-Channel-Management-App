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
