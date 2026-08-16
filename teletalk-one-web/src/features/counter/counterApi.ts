import { env } from '../../env'
import { call } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import * as mock from './counterMock'
import type {
  Campaign,
  CommissionStatement,
  CommissionSummary,
  CustomerRecord,
  LedgerEntry,
  NotificationItem,
  Offer,
  Outstanding,
  Period,
  SalesSummary,
  Stock,
  StockType,
  TargetSummary,
} from './counterTypes'

/**
 * The read surface. All GETs, so all of them get the http client's bounded
 * retry for free — a summary screen that fails on the first dropped packet is
 * a screen a retailer stops trusting.
 *
 * The one POST is the customer lookup, and it is a POST on purpose: see the
 * note on `/customers/search` in the contract.
 */

export async function getStock(type: StockType, signal?: AbortSignal): Promise<Stock> {
  if (env.useMockApi) return mock.getStock(type)
  return call<Stock>(API_ROUTES.stockList, { query: { type }, signal })
}

export async function getCommissionStatement(
  signal?: AbortSignal,
): Promise<CommissionStatement> {
  if (env.useMockApi) return mock.getCommissionStatement()
  return call<CommissionStatement>(API_ROUTES.commissionStatement, { signal })
}

export async function getOutstanding(signal?: AbortSignal): Promise<Outstanding> {
  if (env.useMockApi) return mock.getOutstanding()
  return call<Outstanding>(API_ROUTES.outstandingList, { signal })
}

export async function getTarget(signal?: AbortSignal): Promise<TargetSummary> {
  if (env.useMockApi) return mock.getTarget()
  return call<TargetSummary>(API_ROUTES.targetReport, { signal })
}

export async function getCampaigns(signal?: AbortSignal): Promise<Campaign[]> {
  if (env.useMockApi) return mock.getCampaigns()
  return call<Campaign[]>(API_ROUTES.campaignList, { signal })
}

export async function getOffers(signal?: AbortSignal): Promise<Offer[]> {
  if (env.useMockApi) return mock.getOffers()
  return call<Offer[]>(API_ROUTES.offerList, { signal })
}

export async function getCommission(
  period: Period,
  signal?: AbortSignal,
): Promise<CommissionSummary> {
  if (env.useMockApi) return mock.getCommission(period)
  return call<CommissionSummary>(API_ROUTES.commissionSummary, { query: { period }, signal })
}

export async function getSales(period: Period, signal?: AbortSignal): Promise<SalesSummary> {
  if (env.useMockApi) return mock.getSales(period)
  return call<SalesSummary>(API_ROUTES.salesReport, { query: { period }, signal })
}

export async function getLedger(signal?: AbortSignal): Promise<LedgerEntry[]> {
  if (env.useMockApi) return mock.getLedger()
  return call<LedgerEntry[]>(API_ROUTES.transactionList, { signal })
}

export async function searchCustomers(
  query: string,
  signal?: AbortSignal,
): Promise<CustomerRecord[]> {
  if (env.useMockApi) return mock.searchCustomers(query)
  return call<CustomerRecord[]>(API_ROUTES.customerSearch, { body: { query }, signal })
}

export async function getNotifications(signal?: AbortSignal): Promise<NotificationItem[]> {
  if (env.useMockApi) return mock.getNotifications()
  return call<NotificationItem[]>(API_ROUTES.notificationList, { signal })
}

export async function markNotificationsRead(
  ids: string[],
  signal?: AbortSignal,
): Promise<NotificationItem[]> {
  if (env.useMockApi) return mock.markNotificationsRead(ids)
  return call<NotificationItem[]>(API_ROUTES.notificationsRead, { body: { ids }, signal })
}
