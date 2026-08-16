import type { Bilingual } from '../auth/authTypes'

/**
 * The read surface's contract — stock, commission, the ledger, sales, customer
 * lookup and notifications.
 *
 * Every display string the server owns is `{ bn, en }`, exactly as in the auth
 * contract. A product name, a commission line label and a rejection note are
 * all things the retailer reads aloud to a customer; an English-only DMS field
 * turns a Bangla screen into a mixed-language one no matter how good the
 * client is.
 */

/* -------------------------------- stock --------------------------------- */

export type StockType = 'sim' | 'product'

export interface StockBatch {
  productCode: string
  productName: Bilingual
  count: number
  /**
   * The physical range in the box, so a count can be checked against a shelf.
   * Absent for product stock — a router carton has no serial range.
   */
  firstSerial?: string
  lastSerial?: string
  receivedOn: string
}

export interface Stock {
  type: StockType
  total: number
  /** Below this the outlet should raise a requisition. Server-owned. */
  lowThreshold: number
  batches: StockBatch[]
}

/* ----------------------------- commission ------------------------------- */

export type Period = 'today' | 'week' | 'month'

export interface CommissionLine {
  code: string
  label: Bilingual
  count: number
  amount: number
}

export interface CommissionSummary {
  period: Period
  total: number
  /** Already credited to the TeleCharge balance. */
  paid: number
  /** Earned but not yet settled — the number retailers actually ring about. */
  pending: number
  lines: CommissionLine[]
}

/**
 * The statement behind the commission summary: period by period, with the
 * payment reference for anything already credited. The reference is the point
 * — it is what a retailer quotes when they ring to ask where the money went.
 */
export interface StatementLine {
  period: string
  label: Bilingual
  earned: number
  paid: number
  paidOn?: string
  reference?: string
  status: 'paid' | 'pending'
}

export interface CommissionStatement {
  totalEarned: number
  totalPaid: number
  lines: StatementLine[]
}

/* ----------------------------- outstanding ------------------------------ */

export interface OutstandingItem {
  id: string
  what: Bilingual
  amount: number
  dueOn: string
  /** Zero when it is not yet due. Drives the tone, never colour alone. */
  overdueDays: number
}

export interface Outstanding {
  total: number
  overdue: number
  creditLimit?: number
  items: OutstandingItem[]
}

/* -------------------------------- target -------------------------------- */

export interface TargetLine {
  code: string
  label: Bilingual
  target: number
  achieved: number
  /** Counts render as quantities, money renders with ৳. */
  unit: 'count' | 'money'
}

export interface TargetSummary {
  period: string
  /** Days left in the period. The number that changes behaviour on the 27th. */
  daysLeft: number
  lines: TargetLine[]
}

/* --------------------------- campaigns & offers -------------------------- */

export interface Campaign {
  id: string
  name: Bilingual
  body: Bilingual
  startsOn: string
  endsOn: string
  enrolled: boolean
  /** Present only for an outlet that is actually in the campaign. */
  progress?: { target: number; achieved: number; rewardAmount: number }
}

/**
 * A customer-facing offer. The retailer reads these aloud across a counter, so
 * `code` is what the customer dials and stays Latin.
 */
export interface Offer {
  id: string
  name: Bilingual
  body: Bilingual
  price?: number
  validity?: Bilingual
  code?: string
}

/* ------------------------------- ledger --------------------------------- */

export type LedgerKind =
  | 'activation'
  | 'replacement'
  | 'portIn'
  | 'ownership'
  | 'planMigration'
  | 'recharge'
  | 'productSell'

export type LedgerState = 'settled' | 'pending' | 'failed' | 'reversed'

export interface LedgerEntry {
  /** CBS reference. Latin and monospaced — it gets dictated over the phone. */
  id: string
  kind: LedgerKind
  msisdn: string
  amount?: number
  at: string
  state: LedgerState
  note?: Bilingual
  /** True for a row the client is still holding in its own queue. */
  local?: boolean
}

/* -------------------------------- sales --------------------------------- */

export interface SalesPoint {
  day: string
  activations: number
  rechargeAmount: number
}

export interface SalesSummary {
  period: Period
  activations: number
  recharges: number
  rechargeAmount: number
  commission: number
  /** Monthly activation target, when the outlet has one. */
  target?: number
  points: SalesPoint[]
}

/* ------------------------------- customer ------------------------------- */

export type CustomerStatus = 'active' | 'barred' | 'inactive'

export interface CustomerRecord {
  msisdn: string
  name: Bilingual
  /** Full value; every view masks it. Never rendered unmasked. */
  nid: string
  status: CustomerStatus
  productName: Bilingual
  activatedOn: string
}

/* ----------------------------- notifications ---------------------------- */

export type NotificationSeverity = 'info' | 'warn' | 'action'

export interface NotificationItem {
  id: string
  title: Bilingual
  body: Bilingual
  at: string
  read: boolean
  severity: NotificationSeverity
}
