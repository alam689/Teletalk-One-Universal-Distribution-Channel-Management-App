import { formatIdentifier } from '../../i18n/format'
import type { FieldErrors } from '../wizard/types'
import type { EsafData, FlowData } from './activationTypes'

/**
 * Every rule the e-SAF enforces, in one file, returning `error.*` i18n keys
 * rather than prose. Two reasons that matters here specifically:
 *
 *  - The form is the longest in the product and is filled in Bangla on a
 *    low-end phone. A message that says only "invalid" costs a phone call to
 *    the zonal office; every key below names the correction.
 *  - These rules are regulatory, not cosmetic. Age, NID format and consent are
 *    what BTRC audits. They belong somewhere testable, not inside JSX.
 */

/** Teletalk's own prefix. Other operators are valid as a *contact* number. */
const TELETALK_PREFIX = '015'

const BENGALI = /[ঀ-৿]/
const LATIN_NAME = /^[A-Za-z][A-Za-z .'-]*$/

export const MIN_AGE = 18
export const MAX_AGE = 120
export const MIN_RECHARGE = 10
export const MAX_RECHARGE = 5000

/** The eight divisions, for the address datalist. Server-owned later. */
export const DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
] as const

/* ------------------------------ identifiers ----------------------------- */

/** 10-digit smart card, or 13/17-digit legacy. Nothing else exists. */
export function nidError(raw: string): string | null {
  const nid = formatIdentifier(raw)
  if (!nid) return 'error.nidRequired'
  if (!/^\d+$/.test(nid)) return 'error.nidDigits'
  if (![10, 13, 17].includes(nid.length)) return 'error.nidLength'
  return null
}

export function msisdnError(raw: string, teletalkOnly = false): string | null {
  const msisdn = formatIdentifier(raw)
  if (!msisdn) return 'error.msisdnRequired'
  if (!/^\d+$/.test(msisdn)) return 'error.msisdnDigits'
  if (msisdn.length !== 11 || !msisdn.startsWith('01')) return 'error.msisdnFormat'
  if (teletalkOnly && !msisdn.startsWith(TELETALK_PREFIX)) return 'error.msisdnNotTeletalk'
  return null
}

/** ICCID as printed on the pack: 19 or 20 digits, ITU telecom prefix 89. */
export function simSerialError(raw: string): string | null {
  const serial = formatIdentifier(raw)
  if (!serial) return 'error.simSerialRequired'
  if (!/^\d+$/.test(serial)) return 'error.simSerialDigits'
  if (serial.length < 19 || serial.length > 20) return 'error.simSerialLength'
  if (!serial.startsWith('89')) return 'error.simSerialPrefix'
  return null
}

/* --------------------------------- names -------------------------------- */

export function nameBnError(value: string, requiredKey: string): string | null {
  const name = value.trim()
  if (!name) return requiredKey
  // A Bangla field filled with Latin means the keyboard never switched, and BVS
  // will reject the record after the customer has already left the counter.
  if (!BENGALI.test(name)) return 'error.nameNotBangla'
  if (name.length < 2) return 'error.nameShort'
  return null
}

export function nameEnError(value: string): string | null {
  const name = value.trim()
  if (!name) return 'error.nameEnRequired'
  if (!LATIN_NAME.test(name)) return 'error.nameNotLatin'
  if (name.length < 2) return 'error.nameShort'
  return null
}

/* ---------------------------------- age --------------------------------- */

/** Whole years between `iso` and `today`, or null when the date is unreal. */
export function ageOn(iso: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const born = new Date(Date.UTC(y, m - 1, d))
  // Rejects 2026-02-30, which `new Date` would happily roll into March.
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d) {
    return null
  }
  let age = today.getUTCFullYear() - y
  const beforeBirthday =
    today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d)
  if (beforeBirthday) age -= 1
  return age
}

export function dateOfBirthError(iso: string, today = new Date()): string | null {
  if (!iso) return 'error.dobRequired'
  const age = ageOn(iso, today)
  if (age === null) return 'error.dobInvalid'
  if (age < 0) return 'error.dobFuture'
  if (age < MIN_AGE) return 'error.dobUnderage'
  if (age > MAX_AGE) return 'error.dobInvalid'
  return null
}

/* -------------------------------- address ------------------------------- */

export function postCodeError(raw: string): string | null {
  const code = formatIdentifier(raw)
  if (!code) return 'error.postCodeRequired'
  if (!/^\d{4}$/.test(code)) return 'error.postCodeLength'
  return null
}

/* ------------------------------- composed ------------------------------- */

/** The whole form. Returns every problem at once — one at a time is a queue. */
export function validateEsaf(data: EsafData, today = new Date()): FieldErrors {
  const errors: FieldErrors = {}
  const put = (field: string, key: string | null) => {
    if (key) errors[field] = key
  }

  put('nameBn', nameBnError(data.nameBn, 'error.nameRequired'))
  put('nameEn', nameEnError(data.nameEn))
  put('fatherNameBn', nameBnError(data.fatherNameBn, 'error.fatherNameRequired'))
  put('motherNameBn', nameBnError(data.motherNameBn, 'error.motherNameRequired'))
  put('dateOfBirth', dateOfBirthError(data.dateOfBirth, today))
  if (!data.gender) errors.gender = 'error.genderRequired'
  put('nid', nidError(data.nid))
  put('contactMsisdn', msisdnError(data.contactMsisdn))
  if (!data.division.trim()) errors.division = 'error.divisionRequired'
  if (!data.district.trim()) errors.district = 'error.districtRequired'
  if (!data.upazila.trim()) errors.upazila = 'error.upazilaRequired'
  put('postCode', postCodeError(data.postCode))
  if (!data.addressLine.trim()) errors.addressLine = 'error.addressRequired'
  // Regulatory: no consent, no SIM. Never a warning, always a blocker.
  if (!data.consentKyc) errors.consentKyc = 'error.consentRequired'

  return errors
}

/** A replacement takes a SIM out of stock but sells no plan, hence the flag. */
export function validateSimSelection(data: FlowData, requireProduct = true): FieldErrors {
  const errors: FieldErrors = {}
  const serial = simSerialError(data.simSerial)
  if (serial) errors.simSerial = serial
  if (requireProduct && !data.productCode) errors.productCode = 'error.productRequired'
  return errors
}

export interface NumberStepRules {
  teletalkOnly?: boolean
  requireProduct?: boolean
  requireReason?: boolean
  requireDonor?: boolean
}

export function validateExistingNumber(data: FlowData, rules: NumberStepRules = {}): FieldErrors {
  const errors: FieldErrors = {}
  const msisdn = msisdnError(data.msisdn, rules.teletalkOnly ?? true)
  if (msisdn) errors.msisdn = msisdn
  if (rules.requireProduct && !data.productCode) errors.productCode = 'error.productRequired'
  if (rules.requireReason && !data.reasonCode) errors.reasonCode = 'error.reasonRequired'
  if (rules.requireDonor && !data.donorOperator) errors.donorOperator = 'error.donorRequired'
  return errors
}

export function validateIdentity(data: FlowData, today = new Date()): FieldErrors {
  const errors: FieldErrors = {}
  const nid = nidError(data.nid)
  if (nid) errors.nid = nid
  const dob = dateOfBirthError(data.dateOfBirth, today)
  if (dob) errors.dateOfBirth = dob
  return errors
}

export function validateBiometric(data: FlowData): FieldErrors {
  if (!data.biometric?.reference.trim()) return { biometric: 'error.biometricRequired' }
  if (formatIdentifier(data.biometric.reference).length < 6) {
    return { biometric: 'error.biometricReference' }
  }
  return {}
}

export function validateRecharge(data: FlowData): FieldErrors {
  if (!data.rechargeWanted) return {}
  const raw = formatIdentifier(data.rechargeAmount)
  if (!raw) return { rechargeAmount: 'error.amountRequired' }
  if (!/^\d+$/.test(raw)) return { rechargeAmount: 'error.amountDigits' }
  const amount = Number(raw)
  if (amount < MIN_RECHARGE || amount > MAX_RECHARGE) {
    return { rechargeAmount: 'error.amountRange' }
  }
  return {}
}

/* -------------------------------- masking ------------------------------- */

/**
 * NID as shown in any read-only view — review, receipt, printed slip.
 *
 * The retailer sees what they typed while the field has focus and nowhere else.
 * A counter screen faces the queue behind the customer.
 */
export function maskNid(raw: string): string {
  const nid = formatIdentifier(raw)
  if (nid.length <= 4) return nid
  return `${'•'.repeat(nid.length - 4)}${nid.slice(-4)}`
}

/** Biometric references identify a BVS capture; they are never shown in full. */
export function maskReference(raw: string): string {
  const ref = raw.trim()
  if (ref.length <= 4) return ref
  return `${'•'.repeat(Math.max(4, ref.length - 4))}${ref.slice(-4)}`
}
