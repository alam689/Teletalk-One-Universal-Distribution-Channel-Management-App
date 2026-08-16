import { env } from '../../env'
import { call } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import { outbox, type OutboxEntry } from '../../lib/outbox'
import * as mock from './activationMock'
import type {
  ChoiceNumber,
  MnpRequest,
  NidRecord,
  Product,
  RechargeRequest,
  TransactionRequest,
} from './activationTypes'

/**
 * Counter transactions, split by how they must behave when the network is bad.
 *
 *  - **Reads go direct.** A product list or an NID lookup that does not arrive
 *    is a step the retailer cannot complete; queueing it would only delay the
 *    same dead end.
 *  - **Mutations go through the outbox.** They carry an idempotency key, they
 *    survive a reload, and they are never reported as done until the server
 *    says so.
 *
 * That split is the whole reason `queueTransaction` returns an `OutboxEntry`
 * rather than a promise of a result: there is no promise to give. The screen
 * subscribes to the entry and renders `pending`, `settled` or `failed`.
 */

export const TRANSACTION_PATH = API_ROUTES.transactionCreate.path
export const RECHARGE_PATH = API_ROUTES.transactionRecharge.path

export async function listProducts(signal?: AbortSignal): Promise<Product[]> {
  if (env.useMockApi) return mock.PRODUCTS
  return call<Product[]>(API_ROUTES.catalogueProducts, { signal })
}

/**
 * EC/NID verification. `dateOfBirth` is a second factor: an NID number on its
 * own must never return a citizen's full record.
 */
export async function checkNid(
  nid: string,
  dateOfBirth: string,
  signal?: AbortSignal,
): Promise<NidRecord> {
  if (env.useMockApi) return mock.checkNid(nid, dateOfBirth)
  return call<NidRecord>(API_ROUTES.kycNid, { body: { nid, dateOfBirth }, signal })
}

export async function getMnpRequests(signal?: AbortSignal): Promise<MnpRequest[]> {
  if (env.useMockApi) return mock.getMnpRequests()
  return call<MnpRequest[]>(API_ROUTES.mnpRequests, { signal })
}

export async function searchNumbers(
  pattern: string,
  signal?: AbortSignal,
): Promise<ChoiceNumber[]> {
  if (env.useMockApi) return mock.searchNumbers(pattern)
  return call<ChoiceNumber[]>(API_ROUTES.numberSearch, { query: { pattern }, signal })
}

/** Holding a number is a mutation, so it goes through the queue like one. */
export function queueNumberReservation(msisdn: string, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'numberReserve',
    path: API_ROUTES.numberReserve.path,
    body: { msisdn },
    id,
  })
}

/** Queues the transaction. `entry.id` is the idempotency key; reuse it to retry. */
export function queueTransaction(req: TransactionRequest, id?: string): OutboxEntry {
  return outbox.enqueue({ kind: req.kind, path: TRANSACTION_PATH, body: req, id })
}

export function queueRecharge(req: RechargeRequest, id?: string): OutboxEntry {
  return outbox.enqueue({ kind: 'recharge', path: RECHARGE_PATH, body: req, id })
}
