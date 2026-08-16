import type { Bilingual, Role } from '../auth/authTypes'

/**
 * Channel management: the outlets, the people, the territory they sit in, and
 * the evidence that somebody has actually been to see them.
 *
 * This is the cluster that needed primitives the rest of the app never had —
 * a location, a photograph, and a hierarchy. Two scope calls are recorded in
 * the code where they bite: `geo.ts` for location, and `PosmAuditPage` for the
 * photograph.
 */

/* ------------------------------- retailers ------------------------------ */

export type OutletStatus = 'active' | 'suspended' | 'pending'

export interface RetailerSummary {
  posCode: string
  name: Bilingual
  ownerName: Bilingual
  territory: Bilingual
  tier?: 'platinum' | 'gold' | 'silver'
  status: OutletStatus
  enlistedOn: string
  lastActiveOn?: string
  simStock: number
}

export interface NewRetailer {
  nameBn: string
  nameEn: string
  ownerNameBn: string
  ownerNameEn: string
  nid: string
  msisdn: string
  territory: string
  addressLine: string
}

/**
 * What a new outlet still needs before it can trade: a BVS operator id, DMS
 * access, and a bound device. An outlet with none of these is enlisted on
 * paper and unable to sell anything — which is precisely the gap this screen
 * exists to make visible.
 */
export interface RetailerProvision {
  posCode: string
  outletName: Bilingual
  bvsId?: string
  bvsEnabled: boolean
  dmsEnabled: boolean
  deviceBound: boolean
  updatedOn?: string
}

export interface ProvisionUpdate {
  posCode: string
  bvsId?: string
  bvsEnabled: boolean
  dmsEnabled: boolean
}

/* --------------------------------- users -------------------------------- */

export interface ChannelUser {
  posCode: string
  name: Bilingual
  role: Role
  territory?: Bilingual
  status: 'active' | 'disabled'
  lastSignInOn?: string
}

export interface NewChannelUser {
  posCode: string
  nameBn: string
  nameEn: string
  role: Role
  territory?: string
}

/* ------------------------------- territory ------------------------------ */

export type TerritoryKind = 'zone' | 'territory' | 'route'

export interface TerritoryNode {
  code: string
  name: Bilingual
  kind: TerritoryKind
  outlets: number
  /** Who owns it. A territory with nobody on it is the finding. */
  ownerName?: Bilingual
  children?: TerritoryNode[]
}

/* ------------------------------ field visit ----------------------------- */

export interface GeoPoint {
  lat: number
  lng: number
  /** Metres. A fix with 800m accuracy is not evidence of a visit. */
  accuracy: number
}

export type VisitPurpose = 'routine' | 'stock' | 'complaint' | 'training' | 'audit'

export interface FieldVisit {
  id: string
  posCode: string
  outletName: Bilingual
  visitedOn: string
  purpose: VisitPurpose
  note?: string
  location?: GeoPoint
  /** Metres between the captured fix and the outlet's registered point. */
  distanceMetres?: number
}

export interface NewFieldVisit {
  posCode: string
  purpose: VisitPurpose
  note?: string
  location?: GeoPoint
}

/* ---------------------------------- POSM -------------------------------- */

export interface PosmItem {
  code: string
  label: Bilingual
}

export interface PosmAudit {
  id: string
  posCode: string
  outletName: Bilingual
  auditedOn: string
  present: string[]
  missing: string[]
  /** File name only. See the note in `PosmAuditPage` about upload. */
  photoName?: string
}

export interface NewPosmAudit {
  posCode: string
  present: string[]
  photoName?: string
  note?: string
}

/* -------------------------------- geofence ------------------------------ */

export interface Geofence {
  posCode: string
  outletName: Bilingual
  lat: number
  lng: number
  /** How far from the registered point a transaction may be raised. */
  radiusMetres: number
  updatedOn?: string
}

export interface GeofenceUpdate {
  posCode: string
  lat: number
  lng: number
  radiusMetres: number
}

/* --------------------------------- device ------------------------------- */

export type DeviceState = 'online' | 'stale' | 'offline'

export interface DeviceRecord {
  posCode: string
  outletName: Bilingual
  deviceId: string
  model: string
  appVersion: string
  lastSeenOn: string
  state: DeviceState
}
