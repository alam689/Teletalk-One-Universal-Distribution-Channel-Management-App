import { ApiError } from '../../lib/http'
import type { OutboxEntry } from '../../lib/outbox'
import { distanceMetres } from '../../lib/geo'
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

/** In-repo mock for channel management. */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const daysAgo = (n: number, hour = 11): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 45, 0, 0)
  return d.toISOString()
}
const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString()

/* ------------------------------- retailers ------------------------------ */

const OUTLETS = [
  {
    posCode: '20060794',
    name: { bn: 'সিম ট্রেড কমিউনিকেশন', en: 'SIM Trade Communication' },
    lat: 23.8069,
    lng: 90.3687,
  },
  {
    posCode: '20060801',
    name: { bn: 'হাসান টেলিকম', en: 'Hasan Telecom' },
    lat: 23.7996,
    lng: 90.3719,
  },
  {
    posCode: '20060812',
    name: { bn: 'নিউ স্টার মোবাইল', en: 'New Star Mobile' },
    lat: 23.7935,
    lng: 90.3762,
  },
  {
    posCode: '20060820',
    name: { bn: 'রূপা টেলিকম', en: 'Rupa Telecom' },
    lat: 23.8221,
    lng: 90.3641,
  },
]

let retailers: RetailerSummary[] = [
  {
    posCode: '20060794',
    name: OUTLETS[0].name,
    ownerName: { bn: 'মোঃ রফিকুল ইসলাম', en: 'Md. Rafiqul Islam' },
    territory: { bn: 'মিরপুর-১০', en: 'Mirpur-10' },
    tier: 'gold',
    status: 'active',
    enlistedOn: daysAgo(690),
    lastActiveOn: minutesAgo(35),
    simStock: 148,
  },
  {
    posCode: '20060801',
    name: OUTLETS[1].name,
    ownerName: { bn: 'হাসান মাহমুদ', en: 'Hasan Mahmud' },
    territory: { bn: 'কাজীপাড়া', en: 'Kazipara' },
    tier: 'silver',
    status: 'active',
    enlistedOn: daysAgo(410),
    lastActiveOn: daysAgo(2, 17),
    simStock: 36,
  },
  {
    posCode: '20060812',
    name: OUTLETS[2].name,
    ownerName: { bn: 'নাজমুল হক', en: 'Nazmul Haque' },
    territory: { bn: 'শেওড়াপাড়া', en: 'Shewrapara' },
    tier: 'silver',
    status: 'suspended',
    enlistedOn: daysAgo(230),
    lastActiveOn: daysAgo(28, 12),
    simStock: 0,
  },
  {
    posCode: '20060833',
    name: { bn: 'তালুকদার টেলিকম', en: 'Talukder Telecom' },
    ownerName: { bn: 'সালমা তালুকদার', en: 'Salma Talukder' },
    territory: { bn: 'পল্লবী', en: 'Pallabi' },
    status: 'pending',
    enlistedOn: daysAgo(3),
    simStock: 0,
  },
]

export async function getRetailers(): Promise<RetailerSummary[]> {
  await delay(650)
  return retailers
}

let retailerSequence = 840

function onboardRetailer(body: NewRetailer): RetailerSummary {
  if (retailers.some((r) => r.ownerName.en === body.ownerNameEn.trim())) {
    throw new ApiError('conflict', 409, 'retailerDuplicate')
  }
  const created: RetailerSummary = {
    posCode: `200608${retailerSequence++}`.slice(0, 8),
    name: { bn: body.nameBn.trim(), en: body.nameEn.trim() },
    ownerName: { bn: body.ownerNameBn.trim(), en: body.ownerNameEn.trim() },
    territory: { bn: body.territory, en: body.territory },
    // Enlisted, and unable to sell anything until it is provisioned. That gap
    // is the whole point of the provisioning screen.
    status: 'pending',
    enlistedOn: new Date().toISOString(),
    simStock: 0,
  }
  retailers = [created, ...retailers]
  provisions = [
    {
      posCode: created.posCode,
      outletName: created.name,
      bvsEnabled: false,
      dmsEnabled: false,
      deviceBound: false,
    },
    ...provisions,
  ]
  return created
}

/* ----------------------------- provisioning ----------------------------- */

let provisions: RetailerProvision[] = [
  {
    posCode: '20060794',
    outletName: OUTLETS[0].name,
    bvsId: 'BVS-DHK-4471',
    bvsEnabled: true,
    dmsEnabled: true,
    deviceBound: true,
    updatedOn: daysAgo(688),
  },
  {
    posCode: '20060801',
    outletName: OUTLETS[1].name,
    bvsId: 'BVS-DHK-5120',
    bvsEnabled: true,
    dmsEnabled: true,
    deviceBound: false,
    updatedOn: daysAgo(409),
  },
  {
    posCode: '20060833',
    outletName: { bn: 'তালুকদার টেলিকম', en: 'Talukder Telecom' },
    bvsEnabled: false,
    dmsEnabled: false,
    deviceBound: false,
  },
]

export async function getProvisions(): Promise<RetailerProvision[]> {
  await delay(600)
  return provisions
}

function updateProvision(body: ProvisionUpdate): RetailerProvision {
  const current = provisions.find((p) => p.posCode === body.posCode)
  if (!current) throw new ApiError('notFound', 404, 'outletNotFound')
  // BVS access without an operator id is a permission nobody can use.
  if (body.bvsEnabled && !body.bvsId?.trim()) {
    throw new ApiError('conflict', 409, 'bvsIdRequired')
  }
  const next: RetailerProvision = {
    ...current,
    bvsId: body.bvsId?.trim() || undefined,
    bvsEnabled: body.bvsEnabled,
    dmsEnabled: body.dmsEnabled,
    updatedOn: new Date().toISOString(),
  }
  provisions = provisions.map((p) => (p.posCode === next.posCode ? next : p))
  if (next.bvsEnabled && next.dmsEnabled) {
    retailers = retailers.map((r) =>
      r.posCode === next.posCode && r.status === 'pending' ? { ...r, status: 'active' } : r,
    )
  }
  return next
}

/* --------------------------------- users -------------------------------- */

let users: ChannelUser[] = [
  {
    posCode: '30020001',
    name: { bn: 'রহমান টেলিকম', en: 'Rahman Telecom' },
    role: 'dealer',
    territory: { bn: 'মিরপুর-১০', en: 'Mirpur-10' },
    status: 'active',
    lastSignInOn: minutesAgo(90),
  },
  {
    posCode: '30030001',
    name: { bn: 'কামরুল হাসান', en: 'Kamrul Hasan' },
    role: 'fieldOfficer',
    territory: { bn: 'মিরপুর', en: 'Mirpur' },
    status: 'active',
    lastSignInOn: daysAgo(0, 9),
  },
  {
    posCode: '30010001',
    name: { bn: 'জাহিদুল ইসলাম', en: 'Zahidul Islam' },
    role: 'sr',
    territory: { bn: 'মিরপুর-১০', en: 'Mirpur-10' },
    status: 'active',
    lastSignInOn: daysAgo(0, 8),
  },
  {
    posCode: '30040001',
    name: { bn: 'নাসরিন আক্তার', en: 'Nasrin Akter' },
    role: 'zonal',
    territory: { bn: 'ঢাকা জোন', en: 'Dhaka zone' },
    status: 'active',
    lastSignInOn: daysAgo(1, 16),
  },
  {
    posCode: '30010009',
    name: { bn: 'সোহেল রানা', en: 'Sohel Rana' },
    role: 'sr',
    territory: { bn: 'পল্লবী', en: 'Pallabi' },
    status: 'disabled',
    lastSignInOn: daysAgo(96),
  },
]

export async function getUsers(): Promise<ChannelUser[]> {
  await delay(600)
  return users
}

function createUser(body: NewChannelUser): ChannelUser {
  if (users.some((u) => u.posCode === body.posCode)) {
    throw new ApiError('conflict', 409, 'userDuplicate')
  }
  const created: ChannelUser = {
    posCode: body.posCode,
    name: { bn: body.nameBn.trim(), en: body.nameEn.trim() },
    role: body.role,
    territory: body.territory ? { bn: body.territory, en: body.territory } : undefined,
    status: 'active',
  }
  users = [created, ...users]
  return created
}

/* ------------------------------- territory ------------------------------ */

export async function getTerritories(): Promise<TerritoryNode[]> {
  await delay(550)
  return [
    {
      code: 'ZN-DHK',
      name: { bn: 'ঢাকা জোন', en: 'Dhaka zone' },
      kind: 'zone',
      outlets: 212,
      ownerName: { bn: 'নাসরিন আক্তার', en: 'Nasrin Akter' },
      children: [
        {
          code: 'TR-MIR10',
          name: { bn: 'মিরপুর-১০', en: 'Mirpur-10' },
          kind: 'territory',
          outlets: 64,
          ownerName: { bn: 'কামরুল হাসান', en: 'Kamrul Hasan' },
          children: [
            {
              code: 'RT-MIR10-A',
              name: { bn: 'রুট এ', en: 'Route A' },
              kind: 'route',
              outlets: 22,
              ownerName: { bn: 'জাহিদুল ইসলাম', en: 'Zahidul Islam' },
            },
            {
              code: 'RT-MIR10-B',
              name: { bn: 'রুট বি', en: 'Route B' },
              kind: 'route',
              outlets: 19,
            },
          ],
        },
        {
          code: 'TR-PLB',
          name: { bn: 'পল্লবী', en: 'Pallabi' },
          kind: 'territory',
          outlets: 48,
          children: [
            { code: 'RT-PLB-A', name: { bn: 'রুট এ', en: 'Route A' }, kind: 'route', outlets: 26 },
          ],
        },
      ],
    },
    {
      code: 'ZN-RNG',
      name: { bn: 'রংপুর জোন', en: 'Rangpur zone' },
      kind: 'zone',
      outlets: 154,
      children: [
        {
          code: 'TR-SDP',
          name: { bn: 'সৈয়দপুর', en: 'Saidpur' },
          kind: 'territory',
          outlets: 41,
        },
      ],
    },
  ]
}

/* ------------------------------ field visit ----------------------------- */

let visitSequence = 500
let visits: FieldVisit[] = [
  {
    id: 'FV-2026-0498',
    posCode: '20060794',
    outletName: OUTLETS[0].name,
    visitedOn: daysAgo(0, 10),
    purpose: 'routine',
    note: 'স্টক ও পিওএসএম দেখা হয়েছে।',
    location: { lat: 23.8069, lng: 90.3688, accuracy: 18 },
    distanceMetres: 11,
  },
  {
    id: 'FV-2026-0486',
    posCode: '20060812',
    outletName: OUTLETS[2].name,
    visitedOn: daysAgo(6, 15),
    purpose: 'complaint',
    note: 'ডিভাইস সমস্যার ফলোআপ।',
    location: { lat: 23.7941, lng: 90.3771, accuracy: 42 },
    distanceMetres: 108,
  },
]

export async function getFieldVisits(): Promise<FieldVisit[]> {
  await delay(600)
  return visits
}

function logVisit(body: NewFieldVisit): FieldVisit {
  const outlet = OUTLETS.find((o) => o.posCode === body.posCode)
  if (!outlet) throw new ApiError('notFound', 404, 'outletNotFound')

  const created: FieldVisit = {
    id: `FV-2026-${String(visitSequence++).padStart(4, '0')}`,
    posCode: outlet.posCode,
    outletName: outlet.name,
    visitedOn: new Date().toISOString(),
    purpose: body.purpose,
    note: body.note,
    location: body.location,
    distanceMetres: body.location ? distanceMetres(body.location, outlet) : undefined,
  }
  visits = [created, ...visits]
  return created
}

/* ---------------------------------- POSM -------------------------------- */

export const POSM_ITEMS: PosmItem[] = [
  { code: 'signboard', label: { bn: 'সাইনবোর্ড', en: 'Signboard' } },
  { code: 'poster', label: { bn: 'পোস্টার', en: 'Poster' } },
  { code: 'danglers', label: { bn: 'ড্যাংলার', en: 'Danglers' } },
  { code: 'counterMat', label: { bn: 'কাউন্টার ম্যাট', en: 'Counter mat' } },
  { code: 'priceList', label: { bn: 'মূল্য তালিকা', en: 'Price list' } },
]

let posmSequence = 300
let audits: PosmAudit[] = [
  {
    id: 'PSM-2026-0298',
    posCode: '20060794',
    outletName: OUTLETS[0].name,
    auditedOn: daysAgo(0, 10),
    present: ['signboard', 'poster', 'counterMat', 'priceList'],
    missing: ['danglers'],
    photoName: 'mirpur10-front.jpg',
  },
  {
    id: 'PSM-2026-0281',
    posCode: '20060812',
    outletName: OUTLETS[2].name,
    auditedOn: daysAgo(6, 15),
    present: ['poster'],
    missing: ['signboard', 'danglers', 'counterMat', 'priceList'],
  },
]

export async function getPosmAudits(): Promise<PosmAudit[]> {
  await delay(600)
  return audits
}

function recordAudit(body: NewPosmAudit): PosmAudit {
  const outlet = OUTLETS.find((o) => o.posCode === body.posCode)
  if (!outlet) throw new ApiError('notFound', 404, 'outletNotFound')
  const created: PosmAudit = {
    id: `PSM-2026-${String(posmSequence++).padStart(4, '0')}`,
    posCode: outlet.posCode,
    outletName: outlet.name,
    auditedOn: new Date().toISOString(),
    present: body.present,
    missing: POSM_ITEMS.map((i) => i.code).filter((code) => !body.present.includes(code)),
    photoName: body.photoName,
  }
  audits = [created, ...audits]
  return created
}

/* -------------------------------- geofence ------------------------------ */

let fences: Geofence[] = OUTLETS.map((outlet, index) => ({
  posCode: outlet.posCode,
  outletName: outlet.name,
  lat: outlet.lat,
  lng: outlet.lng,
  radiusMetres: [150, 200, 200, 300][index],
  updatedOn: daysAgo(30 + index * 9),
}))

export async function getGeofences(): Promise<Geofence[]> {
  await delay(550)
  return fences
}

function updateGeofence(body: GeofenceUpdate): Geofence {
  const current = fences.find((f) => f.posCode === body.posCode)
  if (!current) throw new ApiError('notFound', 404, 'outletNotFound')
  // A fence wide enough to cover the next thana is not a control.
  if (body.radiusMetres < 50 || body.radiusMetres > 2000) {
    throw new ApiError('conflict', 409, 'radiusRange')
  }
  const next: Geofence = { ...current, ...body, updatedOn: new Date().toISOString() }
  fences = fences.map((f) => (f.posCode === next.posCode ? next : f))
  return next
}

/* --------------------------------- device ------------------------------- */

export async function getDevices(): Promise<DeviceRecord[]> {
  await delay(600)
  const rows: Omit<DeviceRecord, 'state'>[] = [
    {
      posCode: '20060794',
      outletName: OUTLETS[0].name,
      deviceId: 'AND-7741-2290',
      model: 'Symphony Z55',
      appVersion: '1.4.2',
      lastSeenOn: minutesAgo(12),
    },
    {
      posCode: '20060801',
      outletName: OUTLETS[1].name,
      deviceId: 'AND-7741-3118',
      model: 'Walton Primo R9',
      appVersion: '1.4.2',
      lastSeenOn: minutesAgo(310),
    },
    {
      posCode: '20060812',
      outletName: OUTLETS[2].name,
      deviceId: 'AND-7741-4402',
      model: 'Symphony Z40',
      appVersion: '1.2.8',
      lastSeenOn: daysAgo(28, 12),
    },
  ]
  const now = Date.now()
  return rows.map((row) => {
    const minutes = (now - new Date(row.lastSeenOn).getTime()) / 60_000
    return {
      ...row,
      state: minutes < 60 ? 'online' : minutes < 60 * 24 * 7 ? 'stale' : 'offline',
    }
  })
}

/* ---------------------------- queued mutations --------------------------- */

const settled = new Map<string, unknown>()

export async function handleChannelMutation(entry: OutboxEntry): Promise<unknown> {
  const replay = settled.get(entry.id)
  if (replay) return replay

  await delay(750)
  const body = entry.body as Record<string, unknown>
  let result: unknown

  switch (entry.path) {
    case '/retailers':
      result = onboardRetailer(body as unknown as NewRetailer)
      break
    case '/retailers/provision':
      result = updateProvision(body as unknown as ProvisionUpdate)
      break
    case '/users':
      result = createUser(body as unknown as NewChannelUser)
      break
    case '/field-visits':
      result = logVisit(body as unknown as NewFieldVisit)
      break
    case '/posm':
      result = recordAudit(body as unknown as NewPosmAudit)
      break
    case '/geofences':
      result = updateGeofence(body as unknown as GeofenceUpdate)
      break
    default:
      throw new ApiError('notFound', 404, 'generic')
  }

  settled.set(entry.id, result)
  return result
}

/** Test hook — resets module state between cases. */
export function __resetChannelMock(): void {
  visitSequence = 500
  posmSequence = 300
  retailerSequence = 840
  settled.clear()
}
