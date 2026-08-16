import type { Capability } from '../auth/authTypes'
import type { TransactionKind } from './activationTypes'

/**
 * The five SIM flows, as data.
 *
 * This file is the claim FE-1.1 has to make good on: replacement, port-in,
 * ownership change and plan migration are *configurations* of the activation
 * engine, not four more screens. `flows.test.tsx` drives every spec below
 * through the same `useWizard` and fails if any of them needs engine support.
 *
 * It deliberately holds no JSX and imports no component, so the router can read
 * the id list without pulling the activation feature into the shell bundle.
 */

export type StepKind = 'sim' | 'number' | 'identity' | 'esaf' | 'biometric' | 'review' | 'done'

export interface FlowSpec {
  /** Menu item id — also the route segment under /services. */
  id: string
  capability: Capability
  kind: TransactionKind
  /** Bumping discards drafts of the old shape. */
  version: number
  steps: StepKind[]
  /** Is the number being acted on required to be a Teletalk number? */
  teletalkOnly: boolean
  /** Does the flow offer the inline first recharge on its final step? */
  recharge: boolean
}

export const FLOW_SPECS: FlowSpec[] = [
  {
    id: 'simActivate',
    capability: 'sim.activate',
    kind: 'activation',
    version: 1,
    steps: ['sim', 'identity', 'esaf', 'biometric', 'review', 'done'],
    teletalkOnly: true,
    // The point of the whole exercise: the first recharge happens here, on this
    // login, not after a second sign-in to Telepay.
    recharge: true,
  },
  {
    id: 'simReplace',
    capability: 'sim.replace',
    kind: 'replacement',
    version: 1,
    // No e-SAF: the subscriber record already exists. Biometric stays — a
    // replacement is exactly the transaction identity fraud targets.
    steps: ['number', 'sim', 'identity', 'biometric', 'review', 'done'],
    teletalkOnly: true,
    recharge: false,
  },
  {
    id: 'mnpPortIn',
    capability: 'mnp.portIn',
    kind: 'portIn',
    version: 1,
    // The number is the donor operator's until the regulator says otherwise,
    // so this is the one flow whose number is NOT a Teletalk number.
    steps: ['number', 'identity', 'esaf', 'biometric', 'review', 'done'],
    teletalkOnly: false,
    recharge: false,
  },
  {
    id: 'mnpPortOut',
    capability: 'mnp.portOut',
    kind: 'portOut',
    version: 1,
    // The subscriber is leaving, so there is nothing to enrol and no e-SAF.
    // Identity still matters: this is the transaction that hands someone
    // else's number to whoever is standing at the counter.
    steps: ['number', 'identity', 'biometric', 'review', 'done'],
    teletalkOnly: true,
    recharge: false,
  },
  {
    id: 'ownership',
    capability: 'sim.ownership',
    kind: 'ownership',
    version: 1,
    // A full e-SAF, because the incoming owner is a new subscriber record.
    steps: ['number', 'identity', 'esaf', 'biometric', 'review', 'done'],
    teletalkOnly: true,
    recharge: false,
  },
  {
    id: 'planMigration',
    capability: 'sim.planMigration',
    kind: 'planMigration',
    version: 1,
    // No identity re-check and no biometric: the subscriber is not changing.
    steps: ['number', 'review', 'done'],
    teletalkOnly: true,
    recharge: false,
  },
]

export const FLOW_IDS: string[] = FLOW_SPECS.map((f) => f.id)

export function findFlowSpec(id: string | undefined): FlowSpec | undefined {
  return FLOW_SPECS.find((f) => f.id === id)
}
