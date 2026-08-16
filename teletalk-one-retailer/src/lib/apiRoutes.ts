/**
 * GENERATED FILE — do not edit.
 *
 * Source: openapi/teletalk-one.json (0.4.0)
 * Regenerate: npm run contract:generate
 *
 * Every request the client makes goes through a route in this table. That is
 * what makes the contract a file rather than a convention: a path that is not
 * in the OpenAPI document cannot be called, and CI fails if this file and the
 * document disagree.
 */

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
}

export const API_ROUTES = {
  /** Change the outlet password */
  accountPassword: { method: 'POST', path: '/account/password' },
  /** Look up a POS code and report whether this device is trusted */
  authIdentity: { method: 'POST', path: '/auth/identity' },
  /** Send a one-time code to the outlet's registered MSISDN */
  authOtp: { method: 'POST', path: '/auth/otp' },
  /** Verify the outlet password */
  authPassword: { method: 'POST', path: '/auth/password' },
  /** Exchange the refresh cookie for a new access token */
  authRefresh: { method: 'POST', path: '/auth/refresh' },
  /** Restore the session from the refresh cookie */
  authSession: { method: 'GET', path: '/auth/session' },
  /** End the session and clear the refresh cookie */
  authSignOut: { method: 'POST', path: '/auth/signout' },
  /** Exchange the OTP for a session */
  authVerify: { method: 'POST', path: '/auth/verify' },
  /** Campaigns visible to this outlet */
  campaignList: { method: 'GET', path: '/campaigns' },
  /** Plans the signed-in outlet may sell */
  catalogueProducts: { method: 'GET', path: '/catalogue/products' },
  /** Commission period by period, with payment references */
  commissionStatement: { method: 'GET', path: '/commission/statement' },
  /** Commission earned, split into paid and pending */
  commissionSummary: { method: 'GET', path: '/commission' },
  /** Complaint categories and their SLA windows */
  complaintCategories: { method: 'GET', path: '/complaints/categories' },
  /** Raise a complaint. Requires an Idempotency-Key */
  complaintCreate: { method: 'POST', path: '/complaints' },
  /** Complaints raised by this outlet */
  complaintList: { method: 'GET', path: '/complaints' },
  /** The full subscriber profile. Requires an Idempotency-Key */
  customerProfile: { method: 'POST', path: '/customers/profile' },
  /** Find a subscriber by MSISDN or NID */
  customerSearch: { method: 'POST', path: '/customers/search' },
  /** Devices bound to outlets, and when each was last seen */
  deviceList: { method: 'GET', path: '/devices' },
  /** Log a field visit. Requires an Idempotency-Key */
  fieldVisitCreate: { method: 'POST', path: '/field-visits' },
  /** Logged field visits */
  fieldVisitList: { method: 'GET', path: '/field-visits' },
  /** Geo-fence per outlet */
  geofenceList: { method: 'GET', path: '/geofences' },
  /** Set an outlet's geo-fence. Requires an Idempotency-Key */
  geofenceUpdate: { method: 'POST', path: '/geofences' },
  /** Central or zonal inventory */
  inventoryStock: { method: 'GET', path: '/inventory' },
  /** Verify an NID against the Election Commission record */
  kycNid: { method: 'POST', path: '/kyc/nid' },
  /** Move a lifting request to the next desk. Requires an Idempotency-Key */
  liftingAct: { method: 'POST', path: '/lifting/actions' },
  /** Raise a demand. Requires an Idempotency-Key */
  liftingCreate: { method: 'POST', path: '/lifting/requests' },
  /** What a dealer may lift, at dealer price */
  liftingProducts: { method: 'GET', path: '/lifting/products' },
  /** Lifting requests this session may see */
  liftingRequests: { method: 'GET', path: '/lifting/requests' },
  /** Port-in and port-out requests raised by this outlet */
  mnpRequests: { method: 'GET', path: '/mnp/requests' },
  /** The outlet's notification feed */
  notificationList: { method: 'GET', path: '/notifications' },
  /** Mark notifications as read */
  notificationsRead: { method: 'POST', path: '/notifications/read' },
  /** Hold a number while the customer decides. Requires an Idempotency-Key */
  numberReserve: { method: 'POST', path: '/numbers/reserve' },
  /** Search the choice-number pool */
  numberSearch: { method: 'GET', path: '/numbers' },
  /** Customer-facing offers the retailer can quote */
  offerList: { method: 'GET', path: '/offers' },
  /** What the outlet owes, and how much of it is overdue */
  outstandingList: { method: 'GET', path: '/outstanding' },
  /** Outlet performance scorecard */
  performanceReport: { method: 'GET', path: '/reports/performance' },
  /** Record a POSM audit. Requires an Idempotency-Key */
  posmCreate: { method: 'POST', path: '/posm' },
  /** The POSM checklist */
  posmItems: { method: 'GET', path: '/posm/items' },
  /** POSM audits */
  posmList: { method: 'GET', path: '/posm' },
  /** Provisioning state per outlet */
  provisionList: { method: 'GET', path: '/retailers/provision' },
  /** Grant or withdraw BVS and DMS access. Requires an Idempotency-Key */
  provisionUpdate: { method: 'POST', path: '/retailers/provision' },
  /** Approve, fulfil or reject a requisition. Requires an Idempotency-Key */
  requisitionAct: { method: 'POST', path: '/requisitions/actions' },
  /** Raise a requisition. Requires an Idempotency-Key */
  requisitionCreate: { method: 'POST', path: '/requisitions' },
  /** Requisitions this session may see */
  requisitionList: { method: 'GET', path: '/requisitions' },
  /** Enlist a retailer. Requires an Idempotency-Key */
  retailerCreate: { method: 'POST', path: '/retailers' },
  /** Retailers this session covers */
  retailerList: { method: 'GET', path: '/retailers' },
  /** Sales totals and a per-day series */
  salesReport: { method: 'GET', path: '/reports/sales' },
  /** Settlement records */
  settlementList: { method: 'GET', path: '/settlements' },
  /** Allocate stock from the dealer to a sales representative. Requires an Idempotency-Key */
  srAllocate: { method: 'POST', path: '/sr/allocations' },
  /** The retailers on a sales representative's route today */
  srRoute: { method: 'GET', path: '/sr/route' },
  /** Stock held by the outlet, by batch */
  stockList: { method: 'GET', path: '/stock' },
  /** Return stock, or transfer it to another outlet. Requires an Idempotency-Key */
  stockMove: { method: 'POST', path: '/stock/movements' },
  /** Submit a physical count. Requires an Idempotency-Key */
  stockReconcile: { method: 'POST', path: '/stock/reconcile' },
  /** What the system believes is on the shelf */
  stockReconcileLines: { method: 'GET', path: '/stock/reconcile' },
  /** Subsidy entitlements */
  subsidySummary: { method: 'GET', path: '/subsidy' },
  /** Targets and achievement for the current period */
  targetReport: { method: 'GET', path: '/reports/target' },
  /** Zone, territory and route hierarchy */
  territoryList: { method: 'GET', path: '/territories' },
  /** Raise a counter transaction. Requires an Idempotency-Key */
  transactionCreate: { method: 'POST', path: '/transactions' },
  /** The outlet's transaction ledger */
  transactionList: { method: 'GET', path: '/transactions' },
  /** Recharge a number from the outlet's TeleCharge balance. Requires an Idempotency-Key */
  transactionRecharge: { method: 'POST', path: '/transactions/recharge' },
  /** Create a channel user. Requires an Idempotency-Key */
  userCreate: { method: 'POST', path: '/users' },
  /** Channel users */
  userList: { method: 'GET', path: '/users' },
  /** Record cash collected from a retailer. Requires an Idempotency-Key */
  walletCollect: { method: 'POST', path: '/wallet/collect' },
  /** Wallet balance and ledger */
  walletGet: { method: 'GET', path: '/wallet' },
} as const satisfies Record<string, ApiRoute>

export type ApiOperationId = keyof typeof API_ROUTES

/** Operations that MUST carry an Idempotency-Key. The outbox owns the key. */
export const IDEMPOTENT_OPERATIONS: ApiOperationId[] = [
  'complaintCreate',
  'customerProfile',
  'fieldVisitCreate',
  'geofenceUpdate',
  'liftingAct',
  'liftingCreate',
  'numberReserve',
  'posmCreate',
  'provisionUpdate',
  'requisitionAct',
  'requisitionCreate',
  'retailerCreate',
  'srAllocate',
  'stockMove',
  'stockReconcile',
  'transactionCreate',
  'transactionRecharge',
  'userCreate',
  'walletCollect',
]
