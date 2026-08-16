import type { Capability } from '../auth/authTypes'
import type { IconName } from '../../components/Icon'
import type { CategoryName } from '../../theme/tokens'

/**
 * The retailer's catalogue.
 *
 * The portal carries all 62 tiles because it serves thirteen roles, from the
 * dealer's deposit slip to F&A's revenue assurance. This app serves one desk —
 * the counter — so it carries what a retailer can actually do, which is the
 * `RETAILER` capability set in `roles.ts` and nothing else.
 *
 * That is a scope decision, not a permission one: the capability gate below
 * still runs, so an SR or a sub-dealer signing in here sees their own subset
 * rather than a screen full of things that will refuse them.
 *
 * An item the session lacks the capability for is **absent**, not disabled.
 * A greyed-out row on a counter phone is a question the retailer has to ask
 * somebody about; an absent one is simply not part of their job.
 */

export type Destination =
  /** Pushes the SIM wizard with this flow id. */
  | { screen: 'Flow'; id: string }
  /** Pushes the over-the-counter sale wizard with this sale id. */
  | { screen: 'Sale'; id: string }
  /** Pushes a plain screen by name. */
  | { screen: string; id?: string }

export interface MenuItem {
  id: string
  capability: Capability
  icon: IconName
  category: CategoryName
  to: Destination
}

export interface MenuGroup {
  /** `group.*` i18n key. */
  id: string
  items: MenuItem[]
}

const GROUPS: MenuGroup[] = [
  {
    id: 'sim',
    items: [
      {
        id: 'simActivate',
        capability: 'sim.activate',
        icon: 'sim',
        category: 'sim',
        to: { screen: 'Flow', id: 'simActivate' },
      },
      {
        id: 'simReplace',
        capability: 'sim.replace',
        icon: 'simSwap',
        category: 'sim',
        to: { screen: 'Flow', id: 'simReplace' },
      },
      {
        id: 'ownership',
        capability: 'sim.ownership',
        icon: 'person',
        category: 'sim',
        to: { screen: 'Flow', id: 'ownership' },
      },
      {
        id: 'planMigration',
        capability: 'sim.planMigration',
        icon: 'number',
        category: 'sim',
        to: { screen: 'Flow', id: 'planMigration' },
      },
      {
        id: 'customerSearch',
        capability: 'customer.search',
        icon: 'search',
        category: 'sim',
        to: { screen: 'CustomerSearch' },
      },
    ],
  },
  {
    id: 'mnp',
    items: [
      {
        id: 'mnpPortIn',
        capability: 'mnp.portIn',
        icon: 'portIn',
        category: 'mnp',
        to: { screen: 'Flow', id: 'mnpPortIn' },
      },
      {
        id: 'mnpPortOut',
        capability: 'mnp.portOut',
        icon: 'portOut',
        category: 'mnp',
        to: { screen: 'Flow', id: 'mnpPortOut' },
      },
    ],
  },
  {
    id: 'recharge',
    items: [
      {
        id: 'recharge',
        capability: 'recharge.sell',
        icon: 'bolt',
        category: 'recharge',
        to: { screen: 'Sale', id: 'recharge' },
      },
      {
        id: 'flexiload',
        capability: 'recharge.flexiload',
        icon: 'bolt',
        category: 'recharge',
        to: { screen: 'Sale', id: 'flexiload' },
      },
      {
        id: 'powerload',
        capability: 'recharge.powerload',
        icon: 'bolt',
        category: 'recharge',
        to: { screen: 'Sale', id: 'powerload' },
      },
      {
        id: 'tbps',
        capability: 'recharge.tbps',
        icon: 'card',
        category: 'recharge',
        to: { screen: 'Sale', id: 'tbps' },
      },
      {
        id: 'scratchCard',
        capability: 'recharge.scratchCard',
        icon: 'card',
        category: 'recharge',
        to: { screen: 'Sale', id: 'scratchCard' },
      },
      {
        id: 'productSell',
        capability: 'product.sell',
        icon: 'box',
        category: 'recharge',
        to: { screen: 'Sale', id: 'productSell' },
      },
    ],
  },
  {
    id: 'stock',
    items: [
      {
        id: 'simStock',
        capability: 'stock.sim',
        icon: 'boxes',
        category: 'stock',
        to: { screen: 'Stock', id: 'sim' },
      },
      {
        id: 'productStock',
        capability: 'stock.product',
        icon: 'box',
        category: 'stock',
        to: { screen: 'Stock', id: 'product' },
      },
      {
        id: 'requisition',
        capability: 'requisition.create',
        icon: 'list',
        category: 'stock',
        to: { screen: 'Requisition' },
      },
    ],
  },
  {
    id: 'finance',
    items: [
      {
        id: 'commission',
        capability: 'commission.view',
        icon: 'coin',
        category: 'finance',
        to: { screen: 'Commission' },
      },
      {
        id: 'wallet',
        capability: 'wallet.view',
        icon: 'wallet',
        category: 'finance',
        to: { screen: 'Wallet' },
      },
      {
        id: 'outstanding',
        capability: 'outstanding.view',
        icon: 'invoice',
        category: 'finance',
        to: { screen: 'Outstanding' },
      },
    ],
  },
  {
    id: 'report',
    items: [
      {
        id: 'transactions',
        capability: 'report.transaction',
        icon: 'list',
        category: 'report',
        to: { screen: 'Transactions' },
      },
      {
        id: 'salesReport',
        capability: 'report.sales',
        icon: 'chart',
        category: 'report',
        to: { screen: 'SalesReport' },
      },
      {
        id: 'target',
        capability: 'report.target',
        icon: 'target',
        category: 'report',
        to: { screen: 'Target' },
      },
    ],
  },
  {
    id: 'campaign',
    items: [
      {
        id: 'campaigns',
        capability: 'campaign.view',
        icon: 'megaphone',
        category: 'campaign',
        to: { screen: 'Campaigns' },
      },
      {
        id: 'offers',
        capability: 'offer.view',
        icon: 'gift',
        category: 'campaign',
        to: { screen: 'Offers' },
      },
    ],
  },
  {
    id: 'service',
    items: [
      {
        id: 'complaintCreate',
        capability: 'complaint.create',
        icon: 'ticket',
        category: 'service',
        to: { screen: 'Complaint' },
      },
      {
        id: 'notifications',
        capability: 'notification.view',
        icon: 'bell',
        category: 'service',
        to: { screen: 'Notifications' },
      },
      {
        id: 'support',
        capability: 'support.contact',
        icon: 'help',
        category: 'service',
        to: { screen: 'Support' },
      },
    ],
  },
]

/** The catalogue this session can actually use. Empty groups drop out. */
export function menuFor(can: (capability: Capability) => boolean): MenuGroup[] {
  return GROUPS.map((group) => ({
    id: group.id,
    items: group.items.filter((item) => can(item.capability)),
  })).filter((group) => group.items.length > 0)
}

/**
 * The home screen's shortcuts. Four, because a fifth turns a row a thumb can
 * cross into a grid a thumb has to aim at — and because these four are what a
 * counter does forty times a day.
 */
const QUICK_IDS = ['recharge', 'simActivate', 'flexiload', 'simStock']

export function quickActions(can: (capability: Capability) => boolean): MenuItem[] {
  const all = GROUPS.flatMap((g) => g.items)
  return QUICK_IDS.map((id) => all.find((item) => item.id === id)).filter(
    (item): item is MenuItem => !!item && can(item.capability),
  )
}

export function findMenuItem(id: string): MenuItem | undefined {
  return GROUPS.flatMap((g) => g.items).find((item) => item.id === id)
}
