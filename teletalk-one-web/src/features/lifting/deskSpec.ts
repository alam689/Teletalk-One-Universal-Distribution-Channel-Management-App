import type { Capability } from '../auth/authTypes'
import type { LiftingStage } from './liftingTypes'

/**
 * The eight desks of the lifting chain, as data.
 *
 * Same pattern as `flowSpec.ts` and `saleSpec.ts`, and the same payoff: one
 * screen, eight catalogue tiles. Each desk works the queue of exactly one
 * stage, and the action it may take comes from the state machine rather than
 * from the screen — so a desk cannot accidentally acquire a second action, and
 * the separation of duties survives a redesign.
 */

export interface DeskSpec {
  /** Menu item id — also the route segment under /services. */
  id: string
  capability: Capability
  /** The stage whose queue this desk works. */
  stage: LiftingStage
  /**
   * Show every request this outlet raised, at any stage, rather than only the
   * stage queue. The dealer's own desk needs this: they are waiting on six
   * other people and "where is it now" is the question they open the app to
   * ask.
   */
  ownLedger?: boolean
  /** Only the dealer's desk raises new demand. */
  canCreate?: boolean
}

export const DESK_SPECS: DeskSpec[] = [
  {
    id: 'demandRequest',
    capability: 'lifting.request',
    // Returned requests are the ones sitting on the dealer, but the ledger is
    // what they actually came for.
    stage: 'returned',
    ownLedger: true,
    canCreate: true,
  },
  { id: 'demandRecommend', capability: 'lifting.recommend', stage: 'requested' },
  { id: 'demandApprove', capability: 'lifting.approve', stage: 'recommended' },
  // A queue, not a ledger: this desk is "what do I owe money on", and the
  // dealer already has `demandRequest` for "where is everything".
  { id: 'depositSlip', capability: 'lifting.depositSlip', stage: 'approved' },
  { id: 'depositVerify', capability: 'lifting.depositVerify', stage: 'depositRaised' },
  { id: 'invoiceGenerate', capability: 'lifting.invoice', stage: 'depositVerified' },
  { id: 'revenueAssurance', capability: 'lifting.revenueAssurance', stage: 'invoiced' },
  { id: 'deliveryChallan', capability: 'lifting.challan', stage: 'assured' },
]

export const DESK_IDS: string[] = DESK_SPECS.map((d) => d.id)

export function findDeskSpec(id: string | undefined): DeskSpec | undefined {
  return DESK_SPECS.find((d) => d.id === id)
}
