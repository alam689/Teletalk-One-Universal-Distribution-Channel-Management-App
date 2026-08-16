import { menuFor, quickActions } from './menu'
import { CAPABILITIES_BY_ROLE } from '../auth/roles'
import type { Capability, Role } from '../auth/authTypes'

/**
 * The catalogue is capability-driven, and an item the session lacks is
 * **absent** rather than disabled. A greyed-out row on a counter phone is a
 * question the retailer has to ask somebody about; an absent one is simply not
 * part of their job.
 */

const can = (role: Role) => {
  const held = new Set<Capability>(CAPABILITIES_BY_ROLE[role])
  return (capability: Capability) => held.has(capability)
}

it('gives a retailer the whole counter', () => {
  const groups = menuFor(can('retailer'))
  const ids = groups.flatMap((group) => group.items.map((item) => item.id))

  expect(ids).toContain('simActivate')
  expect(ids).toContain('recharge')
  expect(ids).toContain('requisition')
  expect(ids).toContain('complaintCreate')
})

it('drops what a sales representative cannot do, group and all', () => {
  const groups = menuFor(can('sr'))
  const ids = groups.flatMap((group) => group.items.map((item) => item.id))

  // An SR moves stock; they do not activate SIMs or take a customer's NID.
  expect(ids).not.toContain('simActivate')
  expect(ids).not.toContain('mnpPortIn')
  // And the group empties rather than rendering as a heading over nothing.
  expect(groups.map((group) => group.id)).not.toContain('mnp')
  // What they can do is still there.
  expect(ids).toContain('simStock')
})

it('never offers a quick action the session cannot use', () => {
  const held = can('sr')
  for (const item of quickActions(held)) {
    expect(held(item.capability)).toBe(true)
  }
})
