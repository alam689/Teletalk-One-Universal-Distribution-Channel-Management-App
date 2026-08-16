import { env } from '../../env'
import { call } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import { outbox, type OutboxEntry } from '../../lib/outbox'
import * as mock from './opsMock'
import type {
  Complaint,
  ComplaintCategory,
  CustomerProfile,
  NewCollection,
  NewComplaint,
  NewMovement,
  NewReconcile,
  NewRequisition,
  Performance,
  ReconcileLine,
  Requisition,
  RequisitionAction,
  Settlement,
  SubsidySummary,
  Wallet,
} from './opsTypes'

/**
 * Outlet operations. Reads go direct; anything that moves stock, money or an
 * approval goes through the outbox with an idempotency key, for the same
 * reason as everywhere else — a retailer on a bad line must not be able to
 * send it twice by pressing again.
 */

export async function getRequisitions(signal?: AbortSignal): Promise<Requisition[]> {
  if (env.useMockApi) return mock.getRequisitions()
  return call<Requisition[]>(API_ROUTES.requisitionList, { signal })
}

export function queueRequisition(
  body: NewRequisition,
  actorPosCode: string,
  id?: string,
): OutboxEntry {
  return outbox.enqueue({
    kind: 'requisition',
    path: API_ROUTES.requisitionCreate.path,
    body: { ...body, actorPosCode },
    id,
  })
}

export function queueRequisitionAction(
  body: RequisitionAction,
  actorPosCode: string,
  id?: string,
): OutboxEntry {
  return outbox.enqueue({
    kind: 'requisition',
    path: API_ROUTES.requisitionAct.path,
    body: { ...body, actorPosCode },
    id,
  })
}

/* ------------------------------ complaints ------------------------------ */

export async function getComplaints(signal?: AbortSignal): Promise<Complaint[]> {
  if (env.useMockApi) return mock.getComplaints()
  return call<Complaint[]>(API_ROUTES.complaintList, { signal })
}

export async function getComplaintCategories(
  signal?: AbortSignal,
): Promise<ComplaintCategory[]> {
  if (env.useMockApi) return mock.COMPLAINT_CATEGORIES
  return call<ComplaintCategory[]>(API_ROUTES.complaintCategories, { signal })
}

export function queueComplaint(body: NewComplaint, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'complaint',
    path: API_ROUTES.complaintCreate.path,
    body,
    id,
  })
}

/* --------------------------------- money -------------------------------- */

export async function getWallet(signal?: AbortSignal): Promise<Wallet> {
  if (env.useMockApi) return mock.getWallet()
  return call<Wallet>(API_ROUTES.walletGet, { signal })
}

export function queueCollection(body: NewCollection, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'collection',
    path: API_ROUTES.walletCollect.path,
    body,
    id,
  })
}

export async function getSettlements(signal?: AbortSignal): Promise<Settlement[]> {
  if (env.useMockApi) return mock.getSettlements()
  return call<Settlement[]>(API_ROUTES.settlementList, { signal })
}

export async function getSubsidy(signal?: AbortSignal): Promise<SubsidySummary> {
  if (env.useMockApi) return mock.getSubsidy()
  return call<SubsidySummary>(API_ROUTES.subsidySummary, { signal })
}

/* ---------------------------- stock movements --------------------------- */

export function queueMovement(body: NewMovement, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: body.kind === 'return' ? 'stockReturn' : 'stockTransfer',
    path: API_ROUTES.stockMove.path,
    body,
    id,
  })
}

export async function getReconcileLines(signal?: AbortSignal): Promise<ReconcileLine[]> {
  if (env.useMockApi) return mock.getReconcileLines()
  return call<ReconcileLine[]>(API_ROUTES.stockReconcileLines, { signal })
}

export function queueReconcile(body: NewReconcile, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'stockReconcile',
    path: API_ROUTES.stockReconcile.path,
    body,
    id,
  })
}

/* ------------------------ customer 360 & performance --------------------- */

export async function getCustomerProfile(
  msisdn: string,
  signal?: AbortSignal,
): Promise<CustomerProfile> {
  if (env.useMockApi) return mock.getCustomerProfile(msisdn)
  // POST, like the lookup: an MSISDN in a query string is written to every
  // proxy log between here and CBS.
  return call<CustomerProfile>(API_ROUTES.customerProfile, { body: { msisdn }, signal })
}

export async function getPerformance(signal?: AbortSignal): Promise<Performance> {
  if (env.useMockApi) return mock.getPerformance()
  return call<Performance>(API_ROUTES.performanceReport, { signal })
}
