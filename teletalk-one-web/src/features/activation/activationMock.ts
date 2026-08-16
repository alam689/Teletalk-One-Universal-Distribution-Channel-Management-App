import { ApiError } from '../../lib/http'
import type { OutboxEntry } from '../../lib/outbox'
import {
  NID_SIM_LIMIT,
  type ChoiceNumber,
  type MnpRequest,
  type NumberReservation,
  type NumberTier,
  type NidRecord,
  type Product,
  type RechargeRequest,
  type RechargeResult,
  type TransactionRequest,
  type TransactionResult,
} from './activationTypes'

/**
 * In-repo mock of the counter-transaction services — EC/NID, BVS, CBS and
 * Telepay. Active only while `VITE_API_BASE_URL` is unset.
 *
 * Its job is not to be convincing. It is to **document the contract** and, more
 * importantly, to make every named failure path reachable from the UI so that
 * each one can be given a remedy before the real integration exists. The
 * triggers below are deliberately mechanical (last digits of an identifier) so
 * a reviewer can walk the whole failure surface at a counter in five minutes.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const PRODUCTS: Product[] = [
  { code: 'AGNI', name: { bn: 'অগ্নি', en: 'Agni' }, price: 200 },
  { code: 'BORNOMALA', name: { bn: 'বর্ণমালা', en: 'Bornomala' }, price: 150 },
  { code: 'TARUNNO', name: { bn: 'তারুণ্য', en: 'Tarunno' }, price: 200 },
  { code: 'APON', name: { bn: 'আপন', en: 'Apon' }, price: 250 },
]

const BASE_RECORD: Omit<NidRecord, 'nid'> = {
  nameBn: 'মোছাঃ রেহানা পারভীন',
  nameEn: 'Most. Rehana Parvin',
  fatherNameBn: 'মোঃ আব্দুল করিম',
  motherNameBn: 'মোছাঃ আনোয়ারা বেগম',
  dateOfBirth: '1994-03-17',
  gender: 'female',
  division: 'Rangpur',
  district: 'Nilphamari',
  upazila: 'Saidpur',
  postCode: '5310',
  addressLine: 'হোল্ডিং ১২, মুন্সিপাড়া, সৈয়দপুর',
  simsOnNid: 3,
}

/**
 * EC/NID verification. This lookup is the reason the flow can take five minutes
 * instead of thirty: the e-SAF is pre-filled from the national record rather
 * than re-typed from the card at the counter.
 */
export async function checkNid(nid: string, dateOfBirth: string): Promise<NidRecord> {
  await delay(900)

  if (nid.endsWith('0000')) throw new ApiError('notFound', 404, 'nidNotFound')
  if (nid.endsWith('9999')) throw new ApiError('forbidden', 403, 'nidBlocked')
  if (nid.endsWith('8888')) {
    throw new ApiError('conflict', 409, 'nidSimLimit')
  }

  const record: NidRecord = {
    ...BASE_RECORD,
    nid,
    simsOnNid: nid.endsWith('7777') ? NID_SIM_LIMIT - 1 : BASE_RECORD.simsOnNid,
  }

  // The date of birth is the second factor on the lookup — an NID number alone
  // must not return a citizen's full record.
  if (dateOfBirth && dateOfBirth !== record.dateOfBirth) {
    throw new ApiError('conflict', 409, 'nidDobMismatch')
  }

  return record
}

/* ---------------------------------- MNP ---------------------------------- */

const daysAgo = (n: number, hour = 11): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

export async function getMnpRequests(): Promise<MnpRequest[]> {
  await delay(550)
  return [
    {
      id: 'MNP20268830',
      direction: 'in',
      msisdn: '01711223344',
      operator: 'Grameenphone',
      raisedOn: daysAgo(1),
      status: 'withOperator',
      note: {
        bn: 'দাতা অপারেটরের অনুমোদনের অপেক্ষায়।',
        en: 'Awaiting the donor operator’s clearance.',
      },
      expectedBy: daysAgo(-2),
    },
    {
      id: 'MNP20268812',
      direction: 'out',
      msisdn: '01512009911',
      operator: 'Robi',
      raisedOn: daysAgo(4),
      status: 'approved',
      expectedBy: daysAgo(-1),
    },
    {
      id: 'MNP20268790',
      direction: 'in',
      msisdn: '01812445566',
      operator: 'Banglalink',
      raisedOn: daysAgo(9),
      status: 'completed',
    },
    {
      id: 'MNP20268771',
      direction: 'in',
      msisdn: '01911002233',
      operator: 'Airtel',
      raisedOn: daysAgo(14),
      status: 'rejected',
      note: {
        bn: 'গ্রাহকের নামে বকেয়া থাকায় দাতা অপারেটর অনুমোদন দেয়নি।',
        en: 'The donor operator refused: the customer has an unpaid balance.',
      },
    },
  ]
}

/* ---------------------------- queued mutations ---------------------------- */

let sequence = 1
const settled = new Map<string, TransactionResult | RechargeResult>()

function reference(prefix: string): string {
  const n = String(sequence++).padStart(4, '0')
  return `${prefix}${new Date().getFullYear()}${n}`
}

/** CBS assigns the number. A retailer never invents one. */
function assignMsisdn(simSerial: string): string {
  const tail = simSerial.slice(-7).padStart(7, '0')
  return `0151${tail.slice(-7)}`
}

async function activate(req: TransactionRequest): Promise<TransactionResult> {
  await delay(1200)

  const serial = req.simSerial ?? ''
  if (serial.endsWith('00')) throw new ApiError('conflict', 409, 'simAlreadyActive')
  if (serial.endsWith('11')) throw new ApiError('notFound', 404, 'simNotInStock')
  if (req.biometric?.reference.endsWith('00')) {
    throw new ApiError('forbidden', 403, 'biometricMismatch')
  }

  return {
    transactionId: reference('ACT'),
    msisdn: req.msisdn || assignMsisdn(serial),
    status: 'active',
    completedAt: new Date().toISOString(),
  }
}

async function amend(req: TransactionRequest): Promise<TransactionResult> {
  await delay(1000)
  const msisdn = req.msisdn ?? ''
  if (msisdn.endsWith('00')) throw new ApiError('notFound', 404, 'msisdnNotFound')
  if (msisdn.endsWith('11')) throw new ApiError('forbidden', 403, 'msisdnBarred')
  if (req.kind === 'portIn' && !req.donorOperator) {
    throw new ApiError('conflict', 409, 'donorRequired')
  }

  const PREFIX: Record<string, string> = {
    replacement: 'REP',
    portIn: 'MNP',
    portOut: 'MNP',
    ownership: 'OWN',
    planMigration: 'MIG',
  }

  // Port-in, port-out and ownership change complete at the regulator's pace,
  // not the counter's. Saying "active" here would be the app lying to the
  // customer about a transaction that takes days.
  const slow = ['portIn', 'portOut', 'ownership'].includes(req.kind)

  return {
    transactionId: reference(PREFIX[req.kind] ?? 'TXN'),
    msisdn,
    status: slow ? 'pendingVerification' : 'active',
    completedAt: new Date().toISOString(),
  }
}

async function recharge(req: RechargeRequest): Promise<RechargeResult> {
  await delay(800)
  // A scratch card carries no number, so there is nothing to look up.
  if (req.msisdn?.endsWith('00')) throw new ApiError('notFound', 404, 'msisdnNotFound')
  if (req.amount > 1000) throw new ApiError('forbidden', 403, 'balanceInsufficient')
  return {
    transactionId: reference('RCH'),
    msisdn: req.msisdn,
    amount: req.amount,
    balanceAfter: 4820.5 - req.amount,
    completedAt: new Date().toISOString(),
  }
}

/**
 * The outbox transport, in mock mode.
 *
 * It replays a settled response for a repeated idempotency key rather than
 * doing the work twice — which is exactly the server behaviour the queue's
 * exactly-once guarantee depends on. If the real service does not do this, the
 * guarantee is not real, and this mock is where that requirement is written
 * down.
 */
export async function sendMock(entry: OutboxEntry): Promise<unknown> {
  const replay = settled.get(entry.id)
  if (replay) return replay

  let result: TransactionResult | RechargeResult
  if (entry.path === '/transactions/recharge') {
    result = await recharge(entry.body as RechargeRequest)
  } else if (entry.path === '/numbers/reserve') {
    result = reserve((entry.body as { msisdn: string }).msisdn) as unknown as TransactionResult
  } else {
    const req = entry.body as TransactionRequest
    result = req.kind === 'activation' ? await activate(req) : await amend(req)
  }

  settled.set(entry.id, result)
  return result
}

/** Test hook — resets module state between cases. */
export function __resetActivationMock(): void {
  sequence = 1
  settled.clear()
  numbers = pool()
}

/* ----------------------------- choice number ---------------------------- */

/** How long a hold lasts before the number goes back in the pool. */
export const RESERVATION_MINUTES = 10

const TIER_PRICE: Record<NumberTier, number> = { platinum: 5000, gold: 2000, silver: 500 }

function tierFor(msisdn: string): NumberTier {
  const tail = msisdn.slice(-6)
  if (/(\d)\1{3}/.test(tail)) return 'platinum'
  if (/(\d)\1{2}/.test(tail) || /(0123|1234|2345|3456|4567|5678|6789)/.test(tail)) return 'gold'
  return 'silver'
}

/** A deterministic pool, so a demo shows the same numbers twice running. */
function pool(): ChoiceNumber[] {
  const tails = [
    '7777', '1111', '9999', '1234', '5678', '4321', '7860', '3330',
    '8080', '2020', '5150', '6161', '4747', '9090', '1357', '2468',
  ]
  return tails.flatMap((tail, index) =>
    ['015', '016'].slice(0, 1).map((prefix) => {
      const msisdn = `${prefix}${String(10000 + index * 137).slice(0, 4)}${tail}`
      const tier = tierFor(msisdn)
      return { msisdn, tier, price: TIER_PRICE[tier], status: 'available' as const }
    }),
  )
}

let numbers: ChoiceNumber[] = pool()

/**
 * Search the pool by a fragment the customer asked for — "ending 7777", "with
 * 786". Substring, not prefix: nobody asks for a number by its first digits.
 */
export async function searchNumbers(pattern: string): Promise<ChoiceNumber[]> {
  await delay(600)
  const now = Date.now()
  // Expired holds return to the pool. The server owns this clock; the client
  // only ever displays it.
  numbers = numbers.map((n) =>
    n.status === 'reserved' && n.reservedUntil && new Date(n.reservedUntil).getTime() < now
      ? { ...n, status: 'available', reservedUntil: undefined }
      : n,
  )
  if (pattern.length < 2) throw new ApiError('generic', 400, 'patternTooShort')
  return numbers.filter((n) => n.msisdn.includes(pattern)).slice(0, 12)
}

function reserve(msisdn: string): NumberReservation {
  const found = numbers.find((n) => n.msisdn === msisdn)
  if (!found) throw new ApiError('notFound', 404, 'numberNotFound')
  /**
   * The race this endpoint exists to arbitrate: two counters can press reserve
   * on the same number in the same second, and the client cannot resolve that.
   * The server decides, and the loser gets `numberTaken`.
   */
  if (found.status !== 'available') throw new ApiError('conflict', 409, 'numberTaken')

  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString()
  numbers = numbers.map((n) =>
    n.msisdn === msisdn ? { ...n, status: 'reserved' as const, reservedUntil } : n,
  )
  return { msisdn, reservedUntil, price: found.price }
}
