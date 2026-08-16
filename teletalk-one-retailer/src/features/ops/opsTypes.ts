import type { Bilingual } from '../auth/authTypes'
import type { LedgerEntry } from '../counter/counterTypes'

/**
 * Outlet operations: requisition, complaints, money and stock movements.
 *
 * Four clusters in one module because they share a shape — an outlet raises
 * something, a queue somewhere acts on it, and the outlet needs to see where
 * it got to. Splitting them into four folders would have produced four copies
 * of the same three files.
 */

/* ----------------------------- requisition ------------------------------ */

/**
 * The requisition chain, and deliberately a short one.
 *
 * It is not the lifting chain: no deposit, no invoice, no revenue assurance,
 * because no money moves between the outlet and Teletalk — this is stock
 * moving down the channel against an allocation that has already been paid
 * for. Three stages and one approver.
 */
export type RequisitionStage = 'raised' | 'approved' | 'fulfilled' | 'rejected'

export interface RequisitionLine {
  productCode: string
  productName: Bilingual
  requested: number
  /** What the approver actually released. Absent until approval. */
  approved?: number
}

export interface RequisitionEvent {
  at: string
  action: 'create' | 'approve' | 'fulfil' | 'reject'
  actorPosCode: string
  actorName: Bilingual
  note?: string
}

export interface Requisition {
  id: string
  stage: RequisitionStage
  outletPosCode: string
  outletName: Bilingual
  raisedOn: string
  lines: RequisitionLine[]
  history: RequisitionEvent[]
}

export interface NewRequisition {
  quantities: Record<string, number>
  note?: string
}

export interface RequisitionAction {
  requisitionId: string
  action: 'approve' | 'fulfil' | 'reject'
  approvedQuantities?: Record<string, number>
  note?: string
}

/* ------------------------------ complaints ------------------------------ */

export type ComplaintStatus = 'open' | 'inProgress' | 'resolved' | 'closed'

export interface ComplaintCategory {
  code: string
  label: Bilingual
  /** Hours the SLA allows. Drives the clock on the tracking screen. */
  slaHours: number
}

export interface ComplaintUpdate {
  at: string
  by: Bilingual
  note: string
}

export interface Complaint {
  id: string
  category: string
  categoryLabel: Bilingual
  subject: string
  /** The number the complaint is about, when it is about one. */
  msisdn?: string
  status: ComplaintStatus
  raisedOn: string
  /** When the SLA expires. The screen counts down to this, not up from raisedOn. */
  slaDueOn: string
  resolvedOn?: string
  updates: ComplaintUpdate[]
}

export interface NewComplaint {
  category: string
  subject: string
  detail: string
  msisdn?: string
}

/* -------------------------------- wallet -------------------------------- */

export type WalletEntryKind = 'topUp' | 'sale' | 'commission' | 'adjustment' | 'collection'

export interface WalletEntry {
  id: string
  at: string
  kind: WalletEntryKind
  /** Signed: negative is money leaving the wallet. */
  amount: number
  balanceAfter: number
  reference?: string
}

export interface Wallet {
  balance: number
  /** How far the balance may go negative, where the outlet has a facility. */
  creditLimit?: number
  entries: WalletEntry[]
}

export type CollectionMethod = 'cash' | 'bank' | 'mfs'

export interface NewCollection {
  fromPosCode: string
  amount: number
  method: CollectionMethod
  reference?: string
}

export interface Collection {
  id: string
  fromPosCode: string
  amount: number
  method: CollectionMethod
  collectedOn: string
}

/* ----------------------------- settlement ------------------------------- */

export interface Settlement {
  id: string
  period: Bilingual
  grossSales: number
  commission: number
  /** Withheld: tax, POSM recoveries, adjustments. */
  deductions: number
  net: number
  status: 'settled' | 'pending'
  settledOn?: string
  reference?: string
}

/* ------------------------------- subsidy -------------------------------- */

export interface SubsidyItem {
  code: string
  label: Bilingual
  basis: 'perActivation' | 'monthly'
  rate: number
  earned: number
  status: 'paid' | 'pending'
}

export interface SubsidySummary {
  total: number
  paid: number
  pending: number
  items: SubsidyItem[]
}

/* --------------------------- stock movements ---------------------------- */

export type MovementKind = 'return' | 'transfer'

export interface MovementLine {
  productCode: string
  quantity: number
}

export interface NewMovement {
  kind: MovementKind
  lines: MovementLine[]
  /** Why it is going back. Required on a return. */
  reasonCode?: string
  /** Where it is going. Required on a transfer. */
  toPosCode?: string
  note?: string
}

export interface Movement {
  id: string
  kind: MovementKind
  raisedOn: string
  status: 'submitted' | 'accepted' | 'rejected'
  lines: MovementLine[]
}

/** A physical count against what the system believes. */
export interface ReconcileLine {
  productCode: string
  productName: Bilingual
  system: number
}

export interface NewReconcile {
  counts: Record<string, number>
  note?: string
}

export interface ReconcileResult {
  id: string
  countedOn: string
  /** Signed per product: counted minus system. */
  variance: Record<string, number>
}

/* ----------------------------- customer 360 ----------------------------- */

export interface CustomerSim {
  msisdn: string
  status: 'active' | 'barred' | 'inactive'
  productName: Bilingual
  activatedOn: string
}

export interface CustomerProfile {
  msisdn: string
  name: Bilingual
  nid: string
  balance: number
  planName: Bilingual
  lastRechargeOn?: string
  rechargeLast30Days: number
  /** Every SIM on this NID, which is what the 15-SIM ceiling is counted from. */
  sims: CustomerSim[]
  recentTransactions: LedgerEntry[]
}

/* ----------------------------- performance ------------------------------ */

export interface PerformanceScore {
  code: string
  label: Bilingual
  score: number
  max: number
  trend: 'up' | 'down' | 'flat'
}

export interface Performance {
  period: Bilingual
  overall: number
  /** Rank within the comparison set, when the server computes one. */
  rank?: number
  ofOutlets?: number
  scores: PerformanceScore[]
}
