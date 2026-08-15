/**
 * The contract to freeze with IT&B in Phase 0.
 *
 * Two decisions here are load-bearing and must survive into the real API:
 *
 *  1. The server returns a CAPABILITY SET, not a role string. Navigation,
 *     routes and actions render from capabilities, so Teletalk's real hierarchy
 *     — branch, zonal, field officer, inventory officer, F&A — can be modelled
 *     without a frontend release.
 *
 *  2. Every server-owned display string is `{ bn, en }`. If BVS/CBS/DMS return
 *     English only, the app shows mixed-language screens no matter how well the
 *     client is built.
 */

export type Capability =
  // SIM & customer
  | 'sim.activate'
  | 'sim.replace'
  | 'sim.choiceNumber'
  | 'sim.ownership'
  | 'sim.planMigration'
  | 'customer.search'
  | 'customer.view360'
  // MNP
  | 'mnp.portIn'
  | 'mnp.portOut'
  | 'mnp.status'
  // Recharge & product sales
  | 'recharge.sell'
  | 'recharge.flexiload'
  | 'recharge.powerload'
  | 'recharge.scratchCard'
  | 'recharge.tbps'
  | 'product.sell'
  // Stock & requisition
  | 'stock.sim'
  | 'stock.product'
  | 'stock.transfer'
  | 'stock.return'
  | 'stock.reconcile'
  | 'requisition.create'
  | 'requisition.approve'
  // Lifting chain — deck slides 6 & 7. Each step is owned by a different role.
  | 'lifting.request'
  | 'lifting.recommend'
  | 'lifting.approve'
  | 'lifting.depositSlip'
  | 'lifting.depositVerify'
  | 'lifting.invoice'
  | 'lifting.revenueAssurance'
  | 'lifting.challan'
  | 'inventory.central'
  | 'inventory.zonal'
  | 'sr.route'
  | 'sr.allocate'
  // Commission, wallet & payment
  | 'commission.view'
  | 'commission.statement'
  | 'wallet.view'
  | 'payment.collect'
  | 'settlement.view'
  | 'outstanding.view'
  | 'subsidy.view'
  // Reporting
  | 'report.sales'
  | 'report.transaction'
  | 'report.target'
  | 'report.performance'
  // Campaign & offer
  | 'campaign.view'
  | 'campaign.own'
  | 'offer.view'
  // Service
  | 'complaint.create'
  | 'complaint.track'
  | 'notification.view'
  | 'support.contact'
  // Channel management
  | 'retailer.manage'
  | 'retailer.onboard'
  | 'retailer.provision'
  | 'user.manage'
  | 'territory.manage'
  | 'fieldVisit.log'
  | 'posm.audit'
  | 'geofence.manage'
  | 'device.monitor'

/**
 * Roles the S&D/CRM deck actually requires. `retailer | distributor | zonal`
 * could not express the lifting chain: the demand, the recommendation, the
 * approval, the invoice and the revenue assurance are five different people.
 */
export type Role =
  | 'retailer'
  | 'sr'
  | 'dealer'
  | 'onlineDealer'
  | 'subDealer'
  | 'fieldOfficer'
  | 'zonal'
  | 'invoiceOfficer'
  | 'inventoryOfficer'
  | 'revenueAssurance'
  | 'branchHead'
  | 'csim'
  | 'admin'

export interface Bilingual {
  bn: string
  en: string
}

/** Home summary figures. Every field is optional — an F&A officer has no
 *  TeleCharge balance, and a retailer has nothing pending approval. */
export interface SessionStats {
  balance?: number
  commissionToday?: number
  simStock?: number
  pendingApprovals?: number
}

export interface Session {
  posCode: string
  name: Bilingual
  ownerName: Bilingual
  role: Role
  zone: Bilingual
  territory: Bilingual
  msisdn: string
  outletAddress: Bilingual
  enlistedOn: string
  /** Retailer tier — Platinum / Gold / Silver, per the S&D proposal.
   *  Absent for roles that are not outlets. */
  tier?: 'platinum' | 'gold' | 'silver'
  stats: SessionStats
  capabilities: Capability[]
  deviceTrusted: boolean
  passwordUpdatedOn: string
}

export interface PasswordPolicy {
  minLength: number
  needsUpper: boolean
  needsDigit: boolean
  needsSymbol: boolean
}

export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  needsUpper: true,
  needsDigit: true,
  needsSymbol: true,
}
