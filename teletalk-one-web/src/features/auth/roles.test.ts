import { describe, expect, it } from 'vitest'
import { CAPABILITIES_BY_ROLE } from './roles'
import { DEMO_ACCOUNTS, findAccount, sessionFor } from './demoAccounts'
import { ALL_ITEMS } from '../home/menu'
import type { Capability, Role } from './authTypes'

const ROLES = Object.keys(CAPABILITIES_BY_ROLE) as Role[]

describe('role capability model', () => {
  it('gives every role at least one capability', () => {
    for (const role of ROLES) {
      expect(CAPABILITIES_BY_ROLE[role].length, role).toBeGreaterThan(0)
    }
  })

  it('never grants the same capability twice within a role', () => {
    for (const role of ROLES) {
      const caps = CAPABILITIES_BY_ROLE[role]
      expect(new Set(caps).size, role).toBe(caps.length)
    }
  })

  it('gives admin every capability the menu exposes', () => {
    const admin = new Set(CAPABILITIES_BY_ROLE.admin)
    const missing = ALL_ITEMS.filter((i) => !admin.has(i.capability)).map((i) => i.id)
    expect(missing).toEqual([])
  })

  it('grants no capability that no menu item uses', () => {
    const used = new Set<Capability>(ALL_ITEMS.map((i) => i.capability))
    for (const role of ROLES) {
      const orphans = CAPABILITIES_BY_ROLE[role].filter((c) => !used.has(c))
      expect(orphans, role).toEqual([])
    }
  })

  /**
   * The lifting chain from deck slides 6 and 7 is a separation-of-duties
   * control: the person who recommends is not the person who approves, and
   * neither raises the invoice or clears the revenue. Collapsing any two of
   * these into one role would defeat the control, so it is pinned here.
   */
  it('keeps the lifting chain split across distinct roles', () => {
    const holdersOf = (cap: Capability) =>
      new Set(ROLES.filter((r) => r !== 'admin' && CAPABILITIES_BY_ROLE[r].includes(cap)))

    const request = holdersOf('lifting.request')
    const recommend = holdersOf('lifting.recommend')
    const approve = holdersOf('lifting.approve')
    const revenue = holdersOf('lifting.revenueAssurance')

    // Each step must be held by someone, or the chain has a gap.
    for (const [name, set] of Object.entries({ request, recommend, approve, revenue })) {
      expect(set.size, name).toBeGreaterThan(0)
    }

    // No role may hold two adjacent steps — that is the separation of duties.
    const disjoint = (a: Set<Role>, b: Set<Role>) => [...a].filter((r) => b.has(r))
    expect(disjoint(request, recommend)).toEqual([])
    expect(disjoint(recommend, approve)).toEqual([])
    expect(disjoint(approve, revenue)).toEqual([])
    expect(disjoint(request, approve)).toEqual([])
    expect(disjoint(request, revenue)).toEqual([])
  })

  it('keeps the deposit slip raiser separate from its verifier', () => {
    const raise = ROLES.filter(
      (r) => r !== 'admin' && CAPABILITIES_BY_ROLE[r].includes('lifting.depositSlip'),
    )
    const verify = ROLES.filter(
      (r) => r !== 'admin' && CAPABILITIES_BY_ROLE[r].includes('lifting.depositVerify'),
    )
    expect(raise.length).toBeGreaterThan(0)
    expect(verify.length).toBeGreaterThan(0)
    expect(raise.filter((r) => verify.includes(r))).toEqual([])
  })

  it('does not let a retailer touch any lifting or channel-management step', () => {
    const retailer = CAPABILITIES_BY_ROLE.retailer
    expect(retailer.filter((c) => c.startsWith('lifting.'))).toEqual([])
    expect(retailer.filter((c) => c.startsWith('inventory.'))).toEqual([])
    expect(retailer.filter((c) => c.startsWith('retailer.'))).toEqual([])
    expect(retailer).not.toContain('user.manage')
  })

  it('does not let an F&A officer sell or activate anything', () => {
    const fa = CAPABILITIES_BY_ROLE.revenueAssurance
    expect(fa.filter((c) => c.startsWith('sim.'))).toEqual([])
    expect(fa.filter((c) => c.startsWith('recharge.'))).toEqual([])
  })

  it('gives an online dealer no physical stock movement', () => {
    const online = CAPABILITIES_BY_ROLE.onlineDealer
    expect(online.filter((c) => c.startsWith('stock.'))).toEqual([])
    expect(online).not.toContain('lifting.challan')
  })
})

describe('demo accounts', () => {
  it('provides one account per role', () => {
    const roles = DEMO_ACCOUNTS.map((a) => a.role)
    expect(new Set(roles).size).toBe(roles.length)
    // Every account's role must exist in the capability map.
    for (const role of roles) expect(CAPABILITIES_BY_ROLE[role]).toBeDefined()
  })

  it('uses unique POS codes', () => {
    const codes = DEMO_ACCOUNTS.map((a) => a.posCode)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('builds a session carrying that role’s capabilities', () => {
    const account = findAccount('30070001')
    expect(account?.role).toBe('revenueAssurance')
    const session = sessionFor(account!, false)
    expect(session.capabilities).toContain('lifting.revenueAssurance')
    expect(session.capabilities).not.toContain('sim.activate')
  })

  it('omits the outlet tier for roles that are not outlets', () => {
    expect(findAccount('20060794')?.session.tier).toBe('gold')
    expect(findAccount('30070001')?.session.tier).toBeUndefined()
  })
})
