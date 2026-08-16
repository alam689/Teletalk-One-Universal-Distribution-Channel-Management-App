import { env } from '../../env'
import { call } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import { outbox, type OutboxEntry } from '../../lib/outbox'
import type { Session } from '../auth/authTypes'
import * as mock from './liftingMock'
import type {
  Inventory,
  InventoryScope,
  LiftingActionRequest,
  LiftingRequest,
  NewLiftingRequest,
  NewSrAllocation,
  SrRoute,
} from './liftingTypes'

/**
 * The lifting chain's API.
 *
 * Every mutation goes through the outbox, and that is not a nicety here: a
 * field officer recommends demand from a weak-coverage upazila, and a zonal
 * in-charge approves it from a car. The alternative is an approval that
 * silently did not happen, which on this chain means a dealer waiting a week
 * for a truck nobody dispatched.
 */

export async function getRequests(signal?: AbortSignal): Promise<LiftingRequest[]> {
  if (env.useMockApi) return mock.getRequests()
  return call<LiftingRequest[]>(API_ROUTES.liftingRequests, { signal })
}

/**
 * The actor the mock needs in order to write a history entry.
 *
 * The real service takes the actor from the access token and MUST ignore this
 * — see the note on `/lifting/actions` in the contract. It is sent anyway so
 * the mock can produce a realistic audit trail, and so that the day the real
 * service arrives, deleting this function is the whole change.
 */
function actorOf(session: Session) {
  return {
    actorPosCode: session.posCode,
    actorName: session.ownerName,
    actorRole: session.role,
  }
}

export function queueLiftingAction(
  action: LiftingActionRequest,
  session: Session,
  id?: string,
): OutboxEntry {
  return outbox.enqueue({
    kind: 'lifting',
    path: API_ROUTES.liftingAct.path,
    body: { ...action, ...actorOf(session) },
    id,
  })
}

export function queueNewRequest(
  demand: NewLiftingRequest,
  session: Session,
  id?: string,
): OutboxEntry {
  return outbox.enqueue({
    kind: 'lifting',
    path: API_ROUTES.liftingCreate.path,
    body: { ...demand, ...actorOf(session) },
    id,
  })
}

export async function getLiftingProducts(signal?: AbortSignal): Promise<mock.LiftingProduct[]> {
  if (env.useMockApi) return mock.LIFTING_PRODUCTS
  return call<mock.LiftingProduct[]>(API_ROUTES.liftingProducts, { signal })
}

export async function getInventory(
  scope: InventoryScope,
  signal?: AbortSignal,
): Promise<Inventory> {
  if (env.useMockApi) return mock.getInventory(scope)
  return call<Inventory>(API_ROUTES.inventoryStock, { query: { scope }, signal })
}

export async function getSrRoute(signal?: AbortSignal): Promise<SrRoute> {
  if (env.useMockApi) return mock.getSrRoute()
  return call<SrRoute>(API_ROUTES.srRoute, { signal })
}

export function queueSrAllocation(allocation: NewSrAllocation, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'srAllocation',
    path: API_ROUTES.srAllocate.path,
    body: allocation,
    id,
  })
}
