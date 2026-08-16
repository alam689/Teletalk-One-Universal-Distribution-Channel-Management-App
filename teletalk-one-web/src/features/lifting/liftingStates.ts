import type { Capability } from '../auth/authTypes'
import {
  STAGE_OWNER,
  type LiftingAction,
  type LiftingRequest,
  type LiftingStage,
} from './liftingTypes'

/**
 * The chain's rules, as a pure module.
 *
 * Every one of these is a rule the email version of this process relies on a
 * human remembering. Put them here and they become testable, and the screens
 * stop needing to know them.
 */

interface Transition {
  action: LiftingAction
  /** Stage the request lands in when the action succeeds. */
  to: LiftingStage
  /** Capability required to perform it. */
  capability: Capability
}

/**
 * The forward path. Read down the `to` column and you have slides 6 and 7.
 *
 * Note that no capability appears twice on two *adjacent* rows. That is not a
 * coincidence and it is not decoration: the person who raises the deposit slip
 * must never be the person who verifies it, and the person who recommends a
 * demand must never be the person who approves it. `separationOfDuties` below
 * asserts it, and the test fails the build if a future edit breaks it.
 */
const FORWARD: Record<LiftingStage, Transition | null> = {
  requested: { action: 'recommend', to: 'recommended', capability: 'lifting.recommend' },
  recommended: { action: 'approve', to: 'approved', capability: 'lifting.approve' },
  approved: { action: 'attachDeposit', to: 'depositRaised', capability: 'lifting.depositSlip' },
  depositRaised: {
    action: 'verifyDeposit',
    to: 'depositVerified',
    capability: 'lifting.depositVerify',
  },
  depositVerified: { action: 'invoice', to: 'invoiced', capability: 'lifting.invoice' },
  invoiced: { action: 'assure', to: 'assured', capability: 'lifting.revenueAssurance' },
  assured: { action: 'dispatch', to: 'dispatched', capability: 'lifting.challan' },
  dispatched: { action: 'confirmReceipt', to: 'closed', capability: 'lifting.request' },
  closed: null,
  returned: null,
  rejected: null,
}

/**
 * Sending it back. Available at every desk before the money moves, and at no
 * desk after — once F&A has cleared the payment, "return to the dealer" is an
 * accounting event, not a button.
 */
const RETURNABLE: LiftingStage[] = [
  'requested',
  'recommended',
  'approved',
  'depositRaised',
  'depositVerified',
]

const REJECTABLE: LiftingStage[] = ['requested', 'recommended', 'depositRaised']

export function forwardTransition(stage: LiftingStage): Transition | null {
  return FORWARD[stage]
}

export function ownerCapability(stage: LiftingStage): Capability | null {
  return STAGE_OWNER[stage]
}

export function canReturn(stage: LiftingStage): boolean {
  return RETURNABLE.includes(stage)
}

export function canReject(stage: LiftingStage): boolean {
  return REJECTABLE.includes(stage)
}

/**
 * May this session act on this request at all?
 *
 * Hiding a button is presentation. This is the check the detail screen makes
 * before it renders the action form, and the server must make it again — a
 * request id is guessable, which is exactly why the deep-link guard exists on
 * every other screen in the app.
 */
/** The two stages that belong to the dealer who raised the request. */
const DEALER_SIDE: Capability[] = ['lifting.request', 'lifting.depositSlip']

export function canAct(
  request: Pick<LiftingRequest, 'stage' | 'dealerPosCode'>,
  can: (c: Capability) => boolean,
  posCode: string,
): boolean {
  const capability = ownerCapability(request.stage)
  if (!capability) return false
  if (!can(capability)) return false

  const isRaiser = request.dealerPosCode === posCode

  // A dealer-side stage belongs to the dealer who raised the request, not to
  // every dealer holding the capability.
  if (DEALER_SIDE.includes(capability)) return isRaiser

  /**
   * …and the mirror of that rule, which is the one that is easy to miss.
   *
   * A dealer holds `lifting.challan` because they issue challans for their own
   * outbound deliveries to retailers. The lifting chain's challan step is a
   * different thing: it is the warehouse dispatching goods *to* them. Without
   * this line, a dealer would be able to issue the delivery note for the
   * consignment they themselves are receiving — the requester signing for
   * their own goods, which is precisely the control this chain exists to keep.
   *
   * Stated generally so it holds for any stage added later: whoever raised the
   * request may only act on the dealer-side stages.
   */
  return !isRaiser
}

/** The requests a given desk is actually waiting on. */
export function queueFor(
  requests: LiftingRequest[],
  stage: LiftingStage,
  can: (c: Capability) => boolean,
  posCode: string,
): LiftingRequest[] {
  return requests
    .filter((r) => r.stage === stage)
    .filter((r) => canAct(r, can, posCode))
    .sort((a, b) => new Date(a.raisedOn).getTime() - new Date(b.raisedOn).getTime())
}

/**
 * Pill tone for a stage. Structurally a `StatusTone`, declared without the
 * import so this module stays free of component dependencies.
 */
export function stageTone(stage: LiftingStage): 'ok' | 'warn' | 'danger' | 'muted' {
  if (stage === 'rejected') return 'danger'
  if (stage === 'returned') return 'warn'
  if (stage === 'closed' || stage === 'dispatched') return 'ok'
  return 'muted'
}

/** Position in the chain, for the progress rail. `-1` for the terminal states. */
export function stageIndex(stage: LiftingStage): number {
  const order: LiftingStage[] = [
    'requested',
    'recommended',
    'approved',
    'depositRaised',
    'depositVerified',
    'invoiced',
    'assured',
    'dispatched',
    'closed',
  ]
  return order.indexOf(stage)
}

export const CHAIN_LENGTH = 9

/** Approved value where the zonal in-charge has set one, requested until then. */
export function requestValue(request: Pick<LiftingRequest, 'lines'>): number {
  return request.lines.reduce(
    (sum, line) => sum + (line.approved ?? line.requested) * line.unitPrice,
    0,
  )
}

/**
 * No capability may own two adjacent steps of the chain.
 *
 * This is the separation of duties from deck slides 6 and 7, expressed so that
 * it can be checked rather than remembered. A future edit that gives the
 * invoice officer the approval step, or the dealer the verification step,
 * fails here — which is the whole point of writing it down.
 */
export function separationOfDuties(): { from: LiftingStage; to: LiftingStage }[] {
  const violations: { from: LiftingStage; to: LiftingStage }[] = []
  for (const [stage, transition] of Object.entries(FORWARD)) {
    if (!transition) continue
    const nextTransition = FORWARD[transition.to]
    if (!nextTransition) continue
    if (nextTransition.capability === transition.capability) {
      violations.push({ from: stage as LiftingStage, to: transition.to })
    }
  }
  return violations
}
