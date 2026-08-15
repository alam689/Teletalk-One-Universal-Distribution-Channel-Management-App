import type { Capability } from '../auth/authApi'

export type IconName =
  | 'sim'
  | 'simSwap'
  | 'number'
  | 'transfer'
  | 'migrate'
  | 'search'
  | 'person'
  | 'portIn'
  | 'portOut'
  | 'clock'
  | 'bolt'
  | 'card'
  | 'box'
  | 'boxes'
  | 'truck'
  | 'return'
  | 'coin'
  | 'wallet'
  | 'bank'
  | 'scale'
  | 'chart'
  | 'target'
  | 'list'
  | 'megaphone'
  | 'gift'
  | 'ticket'
  | 'bell'
  | 'help'
  | 'store'
  | 'users'
  | 'map'
  | 'device'
  | 'check'
  | 'invoice'
  | 'poster'
  | 'pin'
  | 'route'
  | 'home'
  | 'grid'
  | 'contrast'
  | 'globe'

export type GroupId =
  | 'sim'
  | 'mnp'
  | 'recharge'
  | 'stock'
  | 'distribution'
  | 'finance'
  | 'report'
  | 'campaign'
  | 'service'
  | 'channel'

export interface MenuItem {
  id: string
  capability: Capability
  icon: IconName
  /** Delivery phase from the programme roadmap — shown on the module screen. */
  phase: 1 | 2 | 3
  /** Injected below; drives the tile's category colour. */
  group: GroupId
}

export interface MenuGroup {
  id: GroupId
  items: MenuItem[]
}

/**
 * The full feature surface, grouped by the eight domains in the Proposed Scope
 * of Development. Items the session lacks the capability for render locked
 * rather than hidden, so the whole surface stays reviewable at this stage.
 */
type RawItem = Omit<MenuItem, 'group'>
interface RawGroup {
  id: GroupId
  items: RawItem[]
}

const GROUPS: RawGroup[] = [
  {
    id: 'sim',
    items: [
      { id: 'simActivate', capability: 'sim.activate', icon: 'sim', phase: 1 },
      { id: 'simReplace', capability: 'sim.replace', icon: 'simSwap', phase: 1 },
      { id: 'choiceNumber', capability: 'sim.choiceNumber', icon: 'number', phase: 2 },
      { id: 'ownership', capability: 'sim.ownership', icon: 'transfer', phase: 2 },
      { id: 'planMigration', capability: 'sim.planMigration', icon: 'migrate', phase: 2 },
      { id: 'customerSearch', capability: 'customer.search', icon: 'search', phase: 1 },
      { id: 'customer360', capability: 'customer.view360', icon: 'person', phase: 3 },
    ],
  },
  {
    id: 'mnp',
    items: [
      { id: 'mnpPortIn', capability: 'mnp.portIn', icon: 'portIn', phase: 2 },
      { id: 'mnpPortOut', capability: 'mnp.portOut', icon: 'portOut', phase: 2 },
      { id: 'mnpStatus', capability: 'mnp.status', icon: 'clock', phase: 2 },
    ],
  },
  {
    id: 'recharge',
    items: [
      { id: 'recharge', capability: 'recharge.sell', icon: 'bolt', phase: 1 },
      { id: 'flexiload', capability: 'recharge.flexiload', icon: 'bolt', phase: 1 },
      { id: 'powerload', capability: 'recharge.powerload', icon: 'bolt', phase: 1 },
      { id: 'scratchCard', capability: 'recharge.scratchCard', icon: 'card', phase: 2 },
      { id: 'tbps', capability: 'recharge.tbps', icon: 'card', phase: 1 },
      { id: 'productSell', capability: 'product.sell', icon: 'box', phase: 1 },
    ],
  },
  {
    id: 'stock',
    items: [
      { id: 'simStock', capability: 'stock.sim', icon: 'boxes', phase: 1 },
      { id: 'productStock', capability: 'stock.product', icon: 'box', phase: 2 },
      { id: 'stockTransfer', capability: 'stock.transfer', icon: 'truck', phase: 3 },
      { id: 'stockReturn', capability: 'stock.return', icon: 'return', phase: 2 },
      { id: 'stockReconcile', capability: 'stock.reconcile', icon: 'scale', phase: 3 },
      { id: 'requisition', capability: 'requisition.create', icon: 'list', phase: 2 },
      { id: 'requisitionApprove', capability: 'requisition.approve', icon: 'check', phase: 3 },
    ],
  },
  {
    /**
     * The lifting chain from slides 6 and 7 of the S&D/CRM deck. Today this
     * runs on email between dealer, field officer, zonal in-charge, zonal
     * invoice officer, F&A revenue assurance and zonal inventory, with ERP
     * touched by hand in the middle. Every step below is a screen that chain
     * needs.
     */
    id: 'distribution',
    items: [
      { id: 'demandRequest', capability: 'lifting.request', icon: 'list', phase: 3 },
      { id: 'demandRecommend', capability: 'lifting.recommend', icon: 'check', phase: 3 },
      { id: 'demandApprove', capability: 'lifting.approve', icon: 'check', phase: 3 },
      { id: 'depositSlip', capability: 'lifting.depositSlip', icon: 'bank', phase: 3 },
      { id: 'depositVerify', capability: 'lifting.depositVerify', icon: 'check', phase: 3 },
      { id: 'invoiceGenerate', capability: 'lifting.invoice', icon: 'invoice', phase: 3 },
      { id: 'revenueAssurance', capability: 'lifting.revenueAssurance', icon: 'scale', phase: 3 },
      { id: 'deliveryChallan', capability: 'lifting.challan', icon: 'truck', phase: 3 },
      { id: 'centralInventory', capability: 'inventory.central', icon: 'boxes', phase: 3 },
      { id: 'zonalInventory', capability: 'inventory.zonal', icon: 'boxes', phase: 3 },
      { id: 'srRoute', capability: 'sr.route', icon: 'route', phase: 3 },
      { id: 'srAllocation', capability: 'sr.allocate', icon: 'transfer', phase: 3 },
    ],
  },
  {
    id: 'finance',
    items: [
      { id: 'commission', capability: 'commission.view', icon: 'coin', phase: 1 },
      { id: 'commissionStatement', capability: 'commission.statement', icon: 'list', phase: 2 },
      { id: 'wallet', capability: 'wallet.view', icon: 'wallet', phase: 2 },
      { id: 'paymentCollect', capability: 'payment.collect', icon: 'bank', phase: 2 },
      { id: 'settlement', capability: 'settlement.view', icon: 'scale', phase: 3 },
      { id: 'outstanding', capability: 'outstanding.view', icon: 'scale', phase: 2 },
      { id: 'subsidy', capability: 'subsidy.view', icon: 'coin', phase: 3 },
    ],
  },
  {
    id: 'report',
    items: [
      { id: 'salesReport', capability: 'report.sales', icon: 'chart', phase: 1 },
      { id: 'transactions', capability: 'report.transaction', icon: 'list', phase: 1 },
      { id: 'target', capability: 'report.target', icon: 'target', phase: 2 },
      { id: 'performance', capability: 'report.performance', icon: 'chart', phase: 3 },
    ],
  },
  {
    id: 'campaign',
    items: [
      { id: 'campaigns', capability: 'campaign.view', icon: 'megaphone', phase: 2 },
      { id: 'myCampaign', capability: 'campaign.own', icon: 'megaphone', phase: 2 },
      { id: 'offers', capability: 'offer.view', icon: 'gift', phase: 2 },
    ],
  },
  {
    id: 'service',
    items: [
      { id: 'complaintCreate', capability: 'complaint.create', icon: 'ticket', phase: 2 },
      { id: 'complaintTrack', capability: 'complaint.track', icon: 'clock', phase: 2 },
      { id: 'notifications', capability: 'notification.view', icon: 'bell', phase: 1 },
      { id: 'support', capability: 'support.contact', icon: 'help', phase: 1 },
    ],
  },
  {
    id: 'channel',
    items: [
      { id: 'retailerManage', capability: 'retailer.manage', icon: 'store', phase: 3 },
      { id: 'retailerOnboard', capability: 'retailer.onboard', icon: 'store', phase: 3 },
      { id: 'retailerProvision', capability: 'retailer.provision', icon: 'check', phase: 3 },
      { id: 'userManage', capability: 'user.manage', icon: 'users', phase: 3 },
      { id: 'territory', capability: 'territory.manage', icon: 'map', phase: 3 },
      { id: 'fieldVisit', capability: 'fieldVisit.log', icon: 'pin', phase: 3 },
      { id: 'posm', capability: 'posm.audit', icon: 'poster', phase: 3 },
      { id: 'geofence', capability: 'geofence.manage', icon: 'pin', phase: 3 },
      { id: 'deviceMonitor', capability: 'device.monitor', icon: 'device', phase: 3 },
    ],
  },
]

/** Group id is injected once here so no definition can drift from its colour. */
export const MENU: MenuGroup[] = GROUPS.map((g) => ({
  id: g.id,
  items: g.items.map((i) => ({ ...i, group: g.id })),
}))

export const ALL_ITEMS: MenuItem[] = MENU.flatMap((g) => g.items)

export function findItem(id: string): MenuItem | undefined {
  return ALL_ITEMS.find((i) => i.id === id)
}

/**
 * Home tiles, resolved against the session's capabilities so each role lands on
 * the four things it actually does. Falls back to whatever the role can reach.
 */
const QUICK_BY_PRIORITY = [
  'simActivate',
  'recharge',
  'simReplace',
  'demandApprove',
  'revenueAssurance',
  'invoiceGenerate',
  'depositVerify',
  'srAllocation',
  'requisitionApprove',
  'retailerOnboard',
  'fieldVisit',
  'simStock',
  'commission',
  'salesReport',
]

export function quickActionsFor(can: (c: Capability) => boolean): MenuItem[] {
  const preferred = QUICK_BY_PRIORITY.map(findItem).filter(
    (i): i is MenuItem => !!i && can(i.capability),
  )
  const rest = ALL_ITEMS.filter((i) => can(i.capability) && !preferred.includes(i))
  return [...preferred, ...rest].slice(0, 4)
}
