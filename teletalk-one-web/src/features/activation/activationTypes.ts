import type { Capability } from '../auth/authTypes'

/**
 * The counter-transaction contract, to freeze with IT&B alongside the auth one.
 *
 * The e-SAF is flat rather than nested because the wizard patches it field by
 * field and an error map is keyed by field name; the API layer is where it
 * becomes the nested request BVS expects. That mapping lives in one function
 * (`toEsafRequest`) so the form shape and the wire shape can diverge without a
 * hunt through the screens.
 */

export type Gender = 'male' | 'female' | 'other'

export interface EsafData {
  /** NID carries both scripts and BVS matches on both. Neither is optional. */
  nameBn: string
  nameEn: string
  fatherNameBn: string
  motherNameBn: string
  /** ISO `YYYY-MM-DD`. */
  dateOfBirth: string
  gender: Gender | ''
  /** 10-digit smart card, or 13/17-digit legacy. Latin digits only. */
  nid: string
  /** Where the customer can be reached — any operator. */
  contactMsisdn: string
  division: string
  district: string
  upazila: string
  postCode: string
  addressLine: string
  /** Regulatory. Without it the transaction cannot be submitted at all. */
  consentKyc: boolean
  /** Optional and genuinely optional — never pre-ticked. */
  consentMarketing: boolean
}

export const EMPTY_ESAF: EsafData = {
  nameBn: '',
  nameEn: '',
  fatherNameBn: '',
  motherNameBn: '',
  dateOfBirth: '',
  gender: '',
  nid: '',
  contactMsisdn: '',
  division: '',
  district: '',
  upazila: '',
  postCode: '',
  addressLine: '',
  consentKyc: false,
  consentMarketing: false,
}

/**
 * What the browser can actually produce.
 *
 * `device` is the only honest value on web: a browser cannot read a fingerprint
 * scanner, so the retailer captures on the BVS device and enters the reference
 * it returns. The React Native app adds `fingerprint`, and the field exists now
 * so the contract does not change when it does.
 */
export type BiometricMethod = 'fingerprint' | 'device'

export interface BiometricCapture {
  method: BiometricMethod
  /** BVS transaction reference from the external capture device. */
  reference: string
  capturedAt: string
}

/** Every flow's data extends this; the engine only ever sees `TData`. */
export interface FlowData extends EsafData {
  /** ICCID printed on the SIM pack. */
  simSerial: string
  /** The number being acted on — assigned by CBS, or the customer's existing one. */
  msisdn: string
  /** Prepaid product/plan code. */
  productCode: string
  /** Donor operator, MNP port-in only. */
  donorOperator: string
  /** Replacement reason code. */
  reasonCode: string
  biometric: BiometricCapture | null
  /** SIMs already on this NID, from the EC lookup. 15 is the BTRC ceiling. */
  simsOnNid: number
  /** Set once the EC/NID lookup has succeeded; the e-SAF is prefilled from it. */
  nidVerifiedAt: string
  /** Recharge is a step inside the flow, not a second login. */
  rechargeWanted: boolean
  rechargeAmount: string
  /** Idempotency key of the queued transaction. Set by the review step. */
  outboxId: string
  /** Idempotency key of the queued recharge. */
  rechargeOutboxId: string
}

export const EMPTY_FLOW_DATA: FlowData = {
  ...EMPTY_ESAF,
  simSerial: '',
  msisdn: '',
  productCode: '',
  donorOperator: '',
  reasonCode: '',
  biometric: null,
  simsOnNid: 0,
  nidVerifiedAt: '',
  rechargeWanted: true,
  rechargeAmount: '',
  outboxId: '',
  rechargeOutboxId: '',
}

/* ------------------------------- the wire ------------------------------- */

export interface EsafRequest {
  name: { bn: string; en: string }
  parents: { fatherBn: string; motherBn: string }
  dateOfBirth: string
  gender: Gender
  nid: string
  contactMsisdn: string
  address: {
    division: string
    district: string
    upazila: string
    postCode: string
    line: string
  }
  consent: { kyc: boolean; marketing: boolean }
}

export type TransactionKind =
  | 'activation'
  | 'replacement'
  | 'portIn'
  | 'portOut'
  | 'ownership'
  | 'planMigration'

export interface TransactionRequest {
  kind: TransactionKind
  posCode: string
  simSerial?: string
  msisdn?: string
  productCode?: string
  donorOperator?: string
  reasonCode?: string
  esaf?: EsafRequest
  biometric?: BiometricCapture
}

export interface TransactionResult {
  /** CBS reference. Latin, monospaced, dictated over the phone. */
  transactionId: string
  /** The number CBS assigned, which for an activation is news to the caller. */
  msisdn: string
  status: 'active' | 'pendingVerification'
  completedAt: string
}

/**
 * How the value reached the customer. The counter treats flexiload, powerload,
 * TBPS and a straight sale as different products with different commission,
 * so the channel travels with the request rather than being inferred from the
 * screen the retailer happened to open.
 */
export type SaleChannel =
  | 'sell'
  | 'flexiload'
  | 'powerload'
  | 'tbps'
  | 'productSell'
  | 'scratchCard'

export interface RechargeRequest {
  /**
   * Absent for a channel that does not target a number — a scratch card is a
   * piece of card sold off the shelf, and the customer types the PIN into
   * their own handset later.
   */
  msisdn?: string
  amount: number
  posCode: string
  channel: SaleChannel
  /** Product/plan code, for a product sale rather than airtime. */
  productCode?: string
}

export interface RechargeResult {
  transactionId: string
  msisdn?: string
  amount: number
  balanceAfter: number
  completedAt: string
}

/**
 * What the EC/NID lookup returns. Pre-filling the e-SAF from the national
 * record instead of re-typing it from the card at the counter is where most of
 * the thirty minutes goes.
 */
export interface NidRecord {
  nid: string
  nameBn: string
  nameEn: string
  fatherNameBn: string
  motherNameBn: string
  dateOfBirth: string
  gender: Gender
  division: string
  district: string
  upazila: string
  postCode: string
  addressLine: string
  /** SIMs already registered against this NID, across all operators. */
  simsOnNid: number
}

/** BTRC: a single NID may hold 15 SIMs across all operators. */
export const NID_SIM_LIMIT = 15

/**
 * A port request the outlet raised, in either direction.
 *
 * MNP completes at the regulator's pace, not the counter's — which is exactly
 * why this screen exists. The customer comes back three days later to ask, and
 * without it the retailer has nothing to tell them.
 */
export type MnpStatus = 'submitted' | 'withOperator' | 'approved' | 'rejected' | 'completed'

export interface MnpRequest {
  id: string
  direction: 'in' | 'out'
  msisdn: string
  /** Donor for a port-in, recipient for a port-out. */
  operator?: string
  raisedOn: string
  status: MnpStatus
  note?: { bn: string; en: string }
  expectedBy?: string
}

/** Plans offered at the counter. Server-owned, so the label is bilingual. */
export interface Product {
  code: string
  name: { bn: string; en: string }
  price: number
}

export interface FlowDescriptor {
  id: string
  capability: Capability
  kind: TransactionKind
}

export function toEsafRequest(data: EsafData): EsafRequest {
  return {
    name: { bn: data.nameBn.trim(), en: data.nameEn.trim() },
    parents: { fatherBn: data.fatherNameBn.trim(), motherBn: data.motherNameBn.trim() },
    dateOfBirth: data.dateOfBirth,
    gender: (data.gender || 'other') as Gender,
    nid: data.nid,
    contactMsisdn: data.contactMsisdn,
    address: {
      division: data.division,
      district: data.district,
      upazila: data.upazila,
      postCode: data.postCode,
      line: data.addressLine.trim(),
    },
    consent: { kyc: data.consentKyc, marketing: data.consentMarketing },
  }
}

/* ----------------------------- choice number ---------------------------- */

/** Pricing band, set by the pattern in the digits rather than by the SIM. */
export type NumberTier = 'platinum' | 'gold' | 'silver'

export interface ChoiceNumber {
  msisdn: string
  tier: NumberTier
  price: number
  status: 'available' | 'reserved' | 'sold'
  /** Set once somebody holds it. The hold expires; the number returns. */
  reservedUntil?: string
}

export interface NumberReservation {
  msisdn: string
  reservedUntil: string
  price: number
}
