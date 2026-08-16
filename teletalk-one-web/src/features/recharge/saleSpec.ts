import type { Capability } from '../auth/authTypes'
import type { SaleChannel } from '../activation/activationTypes'

/**
 * The counter's five over-the-counter sales, as data — same trick as
 * `flowSpec.ts`, same payoff: one screen, five entries in the catalogue.
 *
 * **A caveat worth carrying into the contract review.** Teletalk sells
 * flexiload, powerload and TBPS as distinct products, and the client models
 * the difference it can actually observe: whether the amount is free or comes
 * from a denomination list, and which `channel` the request carries. If the
 * real commercial difference is larger — different balance pools, different
 * settlement, different commission tables — that is a spec change, and it is
 * flagged in STATUS.md as an open question rather than guessed at here.
 */

export interface SaleSpec {
  /** Menu item id — also the route segment under /services. */
  id: string
  capability: Capability
  channel: SaleChannel
  /** Fixed denominations. Empty means any amount inside the published range. */
  denominations: number[]
  /** Sells a catalogue product rather than airtime, so it needs a plan. */
  product: boolean
  /**
   * Does the sale target a mobile number at all?
   *
   * A scratch card does not: it is a piece of card sold off the shelf, and the
   * customer types the PIN into their own handset later. Asking the retailer
   * for a number they do not have would be a field they invent something to
   * get past.
   */
  requiresMsisdn: boolean
  version: number
}

export const SALE_SPECS: SaleSpec[] = [
  {
    id: 'recharge',
    capability: 'recharge.sell',
    channel: 'sell',
    denominations: [],
    product: false,
    requiresMsisdn: true,
    version: 1,
  },
  {
    id: 'flexiload',
    capability: 'recharge.flexiload',
    channel: 'flexiload',
    denominations: [],
    product: false,
    requiresMsisdn: true,
    version: 1,
  },
  {
    id: 'powerload',
    capability: 'recharge.powerload',
    channel: 'powerload',
    // Fixed denominations: powerload is sold as a pack, not as an amount.
    denominations: [50, 100, 200, 300, 500, 1000],
    product: false,
    requiresMsisdn: true,
    version: 1,
  },
  {
    id: 'tbps',
    capability: 'recharge.tbps',
    channel: 'tbps',
    denominations: [],
    product: false,
    requiresMsisdn: true,
    version: 1,
  },
  {
    id: 'productSell',
    capability: 'product.sell',
    channel: 'productSell',
    denominations: [],
    product: true,
    requiresMsisdn: true,
    version: 1,
  },
  {
    id: 'scratchCard',
    capability: 'recharge.scratchCard',
    channel: 'scratchCard',
    // Card face values. Selling one is taking a card off the shelf, not
    // sending value to a number — hence `requiresMsisdn: false`.
    denominations: [20, 50, 100, 200, 500],
    product: false,
    requiresMsisdn: false,
    version: 1,
  },
]

export const SALE_IDS: string[] = SALE_SPECS.map((s) => s.id)

export function findSaleSpec(id: string | undefined): SaleSpec | undefined {
  return SALE_SPECS.find((s) => s.id === id)
}
