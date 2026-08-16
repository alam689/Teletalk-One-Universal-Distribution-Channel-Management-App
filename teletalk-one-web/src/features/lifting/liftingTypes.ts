import type { Bilingual, Capability } from '../auth/authTypes'

/**
 * The lifting chain, from slides 6 and 7 of the S&D/CRM deck.
 *
 * The load-bearing modelling decision, and the one everything else follows
 * from: **this is one object moving through eight desks, not eight screens.**
 * Today the chain runs on email between a dealer, a field officer, a zonal
 * in-charge, a zonal invoice officer, F&A revenue assurance and zonal
 * inventory, with ERP touched by hand in the middle. What the app replaces is
 * not the forms — it is the *handover*: who has it now, what they did to it,
 * and when.
 *
 * So a lifting request carries its own history, every entry is attributable,
 * and no desk can perform another desk's action. `roles.test.ts` already pins
 * the separation of duties in the capability model; `liftingStates.test.ts`
 * pins it in the state machine, and `lifting.test.tsx` pins it in the UI.
 */

/** Who is holding the request right now. Each name says who is waiting. */
export type LiftingStage =
  /** Raised by the dealer, waiting on the field officer. */
  | 'requested'
  /** Recommended, waiting on the zonal in-charge. */
  | 'recommended'
  /** Approved, waiting on the dealer to pay and attach the slip. */
  | 'approved'
  /** Slip attached, waiting on verification — by someone who did not raise it. */
  | 'depositRaised'
  /** Money confirmed, waiting on the ERP invoice. */
  | 'depositVerified'
  /** Invoiced, waiting on F&A revenue assurance. */
  | 'invoiced'
  /** Cleared by F&A, waiting on the delivery challan. */
  | 'assured'
  /** Dispatched, waiting on the dealer to confirm receipt. */
  | 'dispatched'
  /** Received. The chain is done. */
  | 'closed'
  /** Sent back to the dealer with a reason. Re-submittable. */
  | 'returned'
  /** Refused. Terminal. */
  | 'rejected'

export const OPEN_STAGES: LiftingStage[] = [
  'requested',
  'recommended',
  'approved',
  'depositRaised',
  'depositVerified',
  'invoiced',
  'assured',
  'dispatched',
]

/** What a desk does to a request. One action per desk, by design. */
export type LiftingAction =
  | 'create'
  | 'recommend'
  | 'approve'
  | 'attachDeposit'
  | 'verifyDeposit'
  | 'invoice'
  | 'assure'
  | 'dispatch'
  | 'confirmReceipt'
  | 'return'
  | 'reject'

export interface LiftingLine {
  productCode: string
  productName: Bilingual
  /** What the dealer asked for. */
  requested: number
  /** What the zonal in-charge actually approved. Absent until approval. */
  approved?: number
  unitPrice: number
}

/**
 * One entry in the chain's history. This is the part that replaces the email
 * thread, so it records the actor, not just the change.
 */
export interface LiftingEvent {
  at: string
  action: LiftingAction
  /** The POS code of whoever acted. Latin, monospaced, and auditable. */
  actorPosCode: string
  actorName: Bilingual
  actorRole: string
  /** Free text the actor left. Not translated — a person wrote it. */
  note?: string
}

export interface DepositSlip {
  bankName: string
  branch: string
  slipNumber: string
  depositedOn: string
  amount: number
}

export interface LiftingRequest {
  id: string
  stage: LiftingStage
  /** The dealer this belongs to. */
  dealerPosCode: string
  dealerName: Bilingual
  zone: Bilingual
  territory: Bilingual
  raisedOn: string
  lines: LiftingLine[]
  /** Approved value where known, requested value before that. */
  value: number
  deposit?: DepositSlip
  /** ERP invoice number. See the open question about generate vs track. */
  invoiceNumber?: string
  challanNumber?: string
  history: LiftingEvent[]
}

/** The payload a desk sends when it acts. */
export interface LiftingActionRequest {
  requestId: string
  action: LiftingAction
  note?: string
  /** Zonal approval may cut the quantity; `productCode` → approved quantity. */
  approvedQuantities?: Record<string, number>
  deposit?: DepositSlip
  invoiceNumber?: string
  challanNumber?: string
}

export interface NewLiftingRequest {
  /** `productCode` → quantity. */
  quantities: Record<string, number>
  note?: string
}

/* ------------------------------ inventory ------------------------------- */

export type InventoryScope = 'central' | 'zonal'

export interface InventoryLine {
  productCode: string
  productName: Bilingual
  onHand: number
  /** Committed to approved lifting requests but not yet dispatched. */
  allocated: number
  reorderLevel: number
}

export interface InventoryMovement {
  at: string
  /** The lifting request, challan or requisition that moved it. */
  reference: string
  productCode: string
  quantity: number
  direction: 'in' | 'out'
}

export interface Inventory {
  scope: InventoryScope
  location?: Bilingual
  lines: InventoryLine[]
  movements: InventoryMovement[]
}

/* ---------------------------------- SR ---------------------------------- */

export type StopStatus = 'pending' | 'visited' | 'skipped'

export interface SrRouteStop {
  posCode: string
  name: Bilingual
  address: Bilingual
  status: StopStatus
  lastVisitedOn?: string
  outstanding?: number
}

export interface SrRoute {
  srPosCode: string
  srName: Bilingual
  date: string
  stops: SrRouteStop[]
}

export interface SrAllocationLine {
  productCode: string
  productName: Bilingual
  quantity: number
}

export interface SrAllocation {
  id: string
  srPosCode: string
  allocatedOn: string
  lines: SrAllocationLine[]
}

export interface NewSrAllocation {
  srPosCode: string
  quantities: Record<string, number>
}

/** Which capability owns which stage. The separation of duties, as data. */
export const STAGE_OWNER: Record<LiftingStage, Capability | null> = {
  requested: 'lifting.recommend',
  recommended: 'lifting.approve',
  approved: 'lifting.depositSlip',
  depositRaised: 'lifting.depositVerify',
  depositVerified: 'lifting.invoice',
  invoiced: 'lifting.revenueAssurance',
  assured: 'lifting.challan',
  dispatched: 'lifting.request',
  closed: null,
  returned: 'lifting.request',
  rejected: null,
}
