import { describe, expect, it } from 'vitest'
import { CAPABILITIES_BY_ROLE } from '../auth/roles'
import type { Capability, Role } from '../auth/authTypes'
import {
  canAct,
  canReject,
  canReturn,
  forwardTransition,
  ownerCapability,
  queueFor,
  requestValue,
  separationOfDuties,
  stageIndex,
} from './liftingStates'
import { OPEN_STAGES, type LiftingRequest, type LiftingStage } from './liftingTypes'

/**
 * The chain's rules. Every case here is something the email version of this
 * process relies on a human remembering.
 */

const DEALER = '30020001'

const can = (role: Role) => (capability: Capability) =>
  CAPABILITIES_BY_ROLE[role].includes(capability)

const request = (stage: LiftingStage, dealerPosCode = DEALER): LiftingRequest => ({
  id: `LR-${stage}`,
  stage,
  dealerPosCode,
  dealerName: { bn: 'ডিলার', en: 'Dealer' },
  zone: { bn: 'ঢাকা', en: 'Dhaka' },
  territory: { bn: 'মিরপুর', en: 'Mirpur' },
  raisedOn: '2026-08-10T09:00:00Z',
  lines: [],
  value: 0,
  history: [],
})

describe('separation of duties', () => {
  it('no capability owns two adjacent steps of the chain', () => {
    // Deck slides 6 and 7, expressed so it can be checked rather than
    // remembered. A future edit that hands the invoice officer the approval
    // step fails here.
    expect(separationOfDuties()).toEqual([])
  })

  it('the desk that raises the deposit slip never verifies it', () => {
    expect(ownerCapability('approved')).toBe('lifting.depositSlip')
    expect(ownerCapability('depositRaised')).toBe('lifting.depositVerify')
    const dealer = can('dealer')
    expect(dealer('lifting.depositSlip')).toBe(true)
    expect(dealer('lifting.depositVerify')).toBe(false)
  })

  it('the dealer who raised a request cannot issue its delivery challan', () => {
    // A dealer holds `lifting.challan` for their own outbound deliveries to
    // retailers — which would otherwise let them sign for the consignment
    // they are themselves receiving.
    expect(can('dealer')('lifting.challan')).toBe(true)
    expect(canAct(request('assured'), can('dealer'), DEALER)).toBe(false)
    expect(canAct(request('assured'), can('inventoryOfficer'), '30060001')).toBe(true)
  })

  it('every open stage has exactly one owning capability', () => {
    for (const stage of OPEN_STAGES) {
      expect(ownerCapability(stage), stage).not.toBeNull()
    }
  })

  it('a closed or rejected request is nobody’s to act on', () => {
    expect(canAct(request('closed'), can('admin'), '30100001')).toBe(false)
    expect(canAct(request('rejected'), can('admin'), '30100001')).toBe(false)
  })
})

describe('who may act', () => {
  it('routes each stage to the role the deck assigns it', () => {
    const owners: [LiftingStage, Role, string][] = [
      ['requested', 'fieldOfficer', '30030001'],
      ['recommended', 'zonal', '30040001'],
      ['approved', 'dealer', DEALER],
      ['depositRaised', 'fieldOfficer', '30030001'],
      ['depositVerified', 'invoiceOfficer', '30050001'],
      ['invoiced', 'revenueAssurance', '30070001'],
      ['assured', 'inventoryOfficer', '30060001'],
      ['dispatched', 'dealer', DEALER],
    ]
    for (const [stage, role, posCode] of owners) {
      expect(canAct(request(stage), can(role), posCode), stage).toBe(true)
    }
  })

  it('refuses a role that holds no stake in the stage', () => {
    expect(canAct(request('requested'), can('zonal'), '30040001')).toBe(false)
    expect(canAct(request('recommended'), can('fieldOfficer'), '30030001')).toBe(false)
    expect(canAct(request('invoiced'), can('retailer'), '20060794')).toBe(false)
  })

  it('gives a dealer only their own requests', () => {
    expect(canAct(request('approved', '30020001'), can('dealer'), '30020001')).toBe(true)
    expect(canAct(request('approved', '39999999'), can('dealer'), '30020001')).toBe(false)
  })
})

describe('the queue', () => {
  const all = [request('requested'), request('recommended'), request('requested')]

  it('shows a desk only what is waiting on it', () => {
    expect(queueFor(all, 'requested', can('fieldOfficer'), '30030001')).toHaveLength(2)
    expect(queueFor(all, 'recommended', can('fieldOfficer'), '30030001')).toHaveLength(0)
  })

  it('puts the longest-waiting request first', () => {
    const older = { ...request('requested'), id: 'older', raisedOn: '2026-08-01T09:00:00Z' }
    const queue = queueFor([all[0], older], 'requested', can('fieldOfficer'), '30030001')
    expect(queue[0].id).toBe('older')
  })
})

describe('transitions', () => {
  it('walks the chain in the order the deck sets out', () => {
    const path: LiftingStage[] = []
    let stage: LiftingStage = 'requested'
    for (let guard = 0; guard < 12; guard++) {
      const next = forwardTransition(stage)
      if (!next) break
      path.push(next.to)
      stage = next.to
    }
    expect(path).toEqual([
      'recommended',
      'approved',
      'depositRaised',
      'depositVerified',
      'invoiced',
      'assured',
      'dispatched',
      'closed',
    ])
  })

  it('stops sending it back once the money has been cleared', () => {
    // After F&A has signed off, "return to the dealer" is an accounting event,
    // not a button.
    expect(canReturn('depositVerified')).toBe(true)
    expect(canReturn('invoiced')).toBe(false)
    expect(canReturn('assured')).toBe(false)
  })

  it('only allows outright rejection before money has moved', () => {
    expect(canReject('requested')).toBe(true)
    expect(canReject('depositVerified')).toBe(false)
  })

  it('has no forward move out of a terminal stage', () => {
    expect(forwardTransition('closed')).toBeNull()
    expect(forwardTransition('rejected')).toBeNull()
    expect(stageIndex('rejected')).toBe(-1)
  })
})

describe('value', () => {
  it('uses the approved quantity once there is one, and the request until then', () => {
    const lines = [
      { productCode: 'A', productName: { bn: 'ক', en: 'A' }, requested: 100, unitPrice: 10 },
      {
        productCode: 'B',
        productName: { bn: 'খ', en: 'B' },
        requested: 100,
        approved: 60,
        unitPrice: 10,
      },
    ]
    expect(requestValue({ lines })).toBe(1000 + 600)
  })
})
