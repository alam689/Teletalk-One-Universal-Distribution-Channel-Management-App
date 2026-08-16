import { env } from '../../env'
import { call } from '../../lib/http'
import { API_ROUTES } from '../../lib/apiRoutes'
import { outbox, type OutboxEntry } from '../../lib/outbox'
import * as mock from './channelMock'
import type {
  ChannelUser,
  DeviceRecord,
  FieldVisit,
  Geofence,
  GeofenceUpdate,
  NewChannelUser,
  NewFieldVisit,
  NewPosmAudit,
  NewRetailer,
  PosmAudit,
  PosmItem,
  ProvisionUpdate,
  RetailerProvision,
  RetailerSummary,
  TerritoryNode,
} from './channelTypes'

/** Channel management. Reads direct, mutations queued, as everywhere else. */

export async function getRetailers(signal?: AbortSignal): Promise<RetailerSummary[]> {
  if (env.useMockApi) return mock.getRetailers()
  return call<RetailerSummary[]>(API_ROUTES.retailerList, { signal })
}

export function queueRetailerOnboard(body: NewRetailer, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'retailerOnboard',
    path: API_ROUTES.retailerCreate.path,
    body,
    id,
  })
}

export async function getProvisions(signal?: AbortSignal): Promise<RetailerProvision[]> {
  if (env.useMockApi) return mock.getProvisions()
  return call<RetailerProvision[]>(API_ROUTES.provisionList, { signal })
}

export function queueProvision(body: ProvisionUpdate, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'provision',
    path: API_ROUTES.provisionUpdate.path,
    body,
    id,
  })
}

export async function getUsers(signal?: AbortSignal): Promise<ChannelUser[]> {
  if (env.useMockApi) return mock.getUsers()
  return call<ChannelUser[]>(API_ROUTES.userList, { signal })
}

export function queueUser(body: NewChannelUser, id?: string): OutboxEntry {
  return outbox.enqueue({ kind: 'user', path: API_ROUTES.userCreate.path, body, id })
}

export async function getTerritories(signal?: AbortSignal): Promise<TerritoryNode[]> {
  if (env.useMockApi) return mock.getTerritories()
  return call<TerritoryNode[]>(API_ROUTES.territoryList, { signal })
}

export async function getFieldVisits(signal?: AbortSignal): Promise<FieldVisit[]> {
  if (env.useMockApi) return mock.getFieldVisits()
  return call<FieldVisit[]>(API_ROUTES.fieldVisitList, { signal })
}

export function queueFieldVisit(body: NewFieldVisit, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'fieldVisit',
    path: API_ROUTES.fieldVisitCreate.path,
    body,
    id,
  })
}

export async function getPosmAudits(signal?: AbortSignal): Promise<PosmAudit[]> {
  if (env.useMockApi) return mock.getPosmAudits()
  return call<PosmAudit[]>(API_ROUTES.posmList, { signal })
}

export async function getPosmItems(signal?: AbortSignal): Promise<PosmItem[]> {
  if (env.useMockApi) return mock.POSM_ITEMS
  return call<PosmItem[]>(API_ROUTES.posmItems, { signal })
}

export function queuePosmAudit(body: NewPosmAudit, id?: string): OutboxEntry {
  return outbox.enqueue({ kind: 'posm', path: API_ROUTES.posmCreate.path, body, id })
}

export async function getGeofences(signal?: AbortSignal): Promise<Geofence[]> {
  if (env.useMockApi) return mock.getGeofences()
  return call<Geofence[]>(API_ROUTES.geofenceList, { signal })
}

export function queueGeofence(body: GeofenceUpdate, id?: string): OutboxEntry {
  return outbox.enqueue({
    kind: 'geofence',
    path: API_ROUTES.geofenceUpdate.path,
    body,
    id,
  })
}

export async function getDevices(signal?: AbortSignal): Promise<DeviceRecord[]> {
  if (env.useMockApi) return mock.getDevices()
  return call<DeviceRecord[]>(API_ROUTES.deviceList, { signal })
}
