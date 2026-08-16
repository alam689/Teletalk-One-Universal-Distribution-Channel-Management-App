import { ApiError } from '../../lib/http'
import type { OutboxEntry } from '../../lib/outbox'
import { forwardTransition, requestValue } from './liftingStates'
import type {
  Inventory,
  InventoryScope,
  LiftingActionRequest,
  LiftingEvent,
  LiftingLine,
  LiftingRequest,
  NewLiftingRequest,
  NewSrAllocation,
  SrAllocation,
  SrAllocationLine,
  SrRoute,
} from './liftingTypes'

/**
 * In-repo mock of the lifting service — DMS demand, the approval chain, ERP
 * invoicing and the challan.
 *
 * **Two things this mock does that the real service MUST do differently**, and
 * they are written here so they cannot be forgotten at integration time:
 *
 *  1. `getRequests` returns everything. The real endpoint MUST return only the
 *     requests the session's role, zone and territory cover — a dealer must
 *     never receive another dealer's demand, and the client filtering the list
 *     is presentation, not access control.
 *  2. The actor travels in the request body. The real service MUST take the
 *     actor from the access token and ignore any actor in the body. An
 *     approval chain where the client names the approver is not an approval
 *     chain.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const daysAgo = (n: number, hour = 11, minute = 5): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export interface LiftingProduct {
  code: string
  name: { bn: string; en: string }
  unitPrice: number
  /** Sold in packs of this size; demand is a multiple of it. */
  packSize: number
}

export const LIFTING_PRODUCTS: LiftingProduct[] = [
  { code: 'AGNI', name: { bn: 'অগ্নি', en: 'Agni' }, unitPrice: 160, packSize: 50 },
  { code: 'BORNOMALA', name: { bn: 'বর্ণমালা', en: 'Bornomala' }, unitPrice: 120, packSize: 50 },
  { code: 'TARUNNO', name: { bn: 'তারুণ্য', en: 'Tarunno' }, unitPrice: 160, packSize: 50 },
  { code: 'APON', name: { bn: 'আপন', en: 'Apon' }, unitPrice: 200, packSize: 25 },
  {
    code: 'SCRATCH100',
    name: { bn: 'স্ক্র্যাচকার্ড ১০০', en: 'Scratch card ৳100' },
    unitPrice: 96,
    packSize: 100,
  },
]

const DEALER = {
  posCode: '30020001',
  name: { bn: 'রহমান টেলিকম ডিস্ট্রিবিউশন', en: 'Rahman Telecom Distribution' },
  zone: { bn: 'ঢাকা জোন', en: 'Dhaka zone' },
  territory: { bn: 'মিরপুর-১০', en: 'Mirpur-10' },
}

const actor = (
  posCode: string,
  bn: string,
  en: string,
  role: string,
): Pick<LiftingEvent, 'actorPosCode' | 'actorName' | 'actorRole'> => ({
  actorPosCode: posCode,
  actorName: { bn, en },
  actorRole: role,
})

const DEALER_ACTOR = actor('30020001', 'রহমান টেলিকম', 'Rahman Telecom', 'dealer')
const FO_ACTOR = actor('30030001', 'কামরুল হাসান', 'Kamrul Hasan', 'fieldOfficer')
const ZONAL_ACTOR = actor('30040001', 'নাসরিন আক্তার', 'Nasrin Akter', 'zonal')
const INVOICE_ACTOR = actor('30050001', 'তানভীর আহমেদ', 'Tanvir Ahmed', 'invoiceOfficer')
const FNA_ACTOR = actor('30070001', 'সাবরিনা রহমান', 'Sabrina Rahman', 'revenueAssurance')

function lines(spec: [string, number, number?][]): LiftingLine[] {
  return spec.map(([code, requested, approved]) => {
    const product = LIFTING_PRODUCTS.find((p) => p.code === code)
    if (!product) throw new Error(`unknown product ${code}`)
    return {
      productCode: product.code,
      productName: product.name,
      requested,
      approved,
      unitPrice: product.unitPrice,
    }
  })
}

let sequence = 100

function makeRequest(
  stage: LiftingRequest['stage'],
  raisedDaysAgo: number,
  requestLines: LiftingLine[],
  history: LiftingEvent[],
  extra: Partial<LiftingRequest> = {},
): LiftingRequest {
  const base: LiftingRequest = {
    id: `LR-2026-${String(sequence++).padStart(4, '0')}`,
    stage,
    dealerPosCode: DEALER.posCode,
    dealerName: DEALER.name,
    zone: DEALER.zone,
    territory: DEALER.territory,
    raisedOn: daysAgo(raisedDaysAgo),
    lines: requestLines,
    value: 0,
    history,
    ...extra,
  }
  return { ...base, value: requestValue(base) }
}

/**
 * One request sitting at each desk, so every demo account has something in its
 * queue and the whole chain is walkable in one sitting.
 */
function seed(): LiftingRequest[] {
  sequence = 100
  return [
    makeRequest('requested', 1, lines([['AGNI', 500], ['APON', 100]]), [
      { at: daysAgo(1), action: 'create', ...DEALER_ACTOR, note: 'সাপ্তাহিক চাহিদা' },
    ]),
    makeRequest('recommended', 2, lines([['BORNOMALA', 300], ['TARUNNO', 200]]), [
      { at: daysAgo(2), action: 'create', ...DEALER_ACTOR },
      { at: daysAgo(2, 15), action: 'recommend', ...FO_ACTOR, note: 'স্টক যাচাই করা হয়েছে' },
    ]),
    makeRequest('approved', 3, lines([['AGNI', 400, 300]]), [
      { at: daysAgo(3), action: 'create', ...DEALER_ACTOR },
      { at: daysAgo(3, 14), action: 'recommend', ...FO_ACTOR },
      {
        at: daysAgo(2, 10),
        action: 'approve',
        ...ZONAL_ACTOR,
        note: 'কেন্দ্রীয় স্টক অনুযায়ী ৩০০ অনুমোদন',
      },
    ]),
    makeRequest(
      'depositRaised',
      5,
      lines([['SCRATCH100', 1000, 1000]]),
      [
        { at: daysAgo(5), action: 'create', ...DEALER_ACTOR },
        { at: daysAgo(5, 13), action: 'recommend', ...FO_ACTOR },
        { at: daysAgo(4, 11), action: 'approve', ...ZONAL_ACTOR },
        { at: daysAgo(4, 16), action: 'attachDeposit', ...DEALER_ACTOR },
      ],
      {
        deposit: {
          bankName: 'Sonali Bank',
          branch: 'Mirpur-10',
          slipNumber: '4471290',
          depositedOn: daysAgo(4),
          amount: 96_000,
        },
      },
    ),
    makeRequest(
      'depositVerified',
      7,
      lines([['TARUNNO', 600, 600]]),
      [
        { at: daysAgo(7), action: 'create', ...DEALER_ACTOR },
        { at: daysAgo(7, 12), action: 'recommend', ...FO_ACTOR },
        { at: daysAgo(6, 10), action: 'approve', ...ZONAL_ACTOR },
        { at: daysAgo(6, 15), action: 'attachDeposit', ...DEALER_ACTOR },
        { at: daysAgo(5, 11), action: 'verifyDeposit', ...FO_ACTOR, note: 'ব্যাংক স্টেটমেন্টে মিলেছে' },
      ],
      {
        deposit: {
          bankName: 'Janata Bank',
          branch: 'Kazipara',
          slipNumber: '8830145',
          depositedOn: daysAgo(6),
          amount: 96_000,
        },
      },
    ),
    makeRequest(
      'invoiced',
      9,
      lines([['AGNI', 800, 800]]),
      [
        { at: daysAgo(9), action: 'create', ...DEALER_ACTOR },
        { at: daysAgo(9, 12), action: 'recommend', ...FO_ACTOR },
        { at: daysAgo(8, 10), action: 'approve', ...ZONAL_ACTOR },
        { at: daysAgo(8, 14), action: 'attachDeposit', ...DEALER_ACTOR },
        { at: daysAgo(7, 11), action: 'verifyDeposit', ...FO_ACTOR },
        { at: daysAgo(7, 16), action: 'invoice', ...INVOICE_ACTOR },
      ],
      { invoiceNumber: 'ERP-INV-2026-3341' },
    ),
    makeRequest(
      'assured',
      12,
      lines([['APON', 200, 200], ['BORNOMALA', 400, 400]]),
      [
        { at: daysAgo(12), action: 'create', ...DEALER_ACTOR },
        { at: daysAgo(12, 12), action: 'recommend', ...FO_ACTOR },
        { at: daysAgo(11, 10), action: 'approve', ...ZONAL_ACTOR },
        { at: daysAgo(11, 15), action: 'attachDeposit', ...DEALER_ACTOR },
        { at: daysAgo(10, 11), action: 'verifyDeposit', ...FO_ACTOR },
        { at: daysAgo(10, 15), action: 'invoice', ...INVOICE_ACTOR },
        { at: daysAgo(9, 12), action: 'assure', ...FNA_ACTOR, note: 'জমা ও ইনভয়েস মিলেছে' },
      ],
      { invoiceNumber: 'ERP-INV-2026-3298' },
    ),
    makeRequest(
      'dispatched',
      16,
      lines([['AGNI', 1000, 1000]]),
      [
        { at: daysAgo(16), action: 'create', ...DEALER_ACTOR },
        { at: daysAgo(15, 12), action: 'recommend', ...FO_ACTOR },
        { at: daysAgo(15, 15), action: 'approve', ...ZONAL_ACTOR },
        { at: daysAgo(14, 10), action: 'attachDeposit', ...DEALER_ACTOR },
        { at: daysAgo(14, 14), action: 'verifyDeposit', ...FO_ACTOR },
        { at: daysAgo(13, 11), action: 'invoice', ...INVOICE_ACTOR },
        { at: daysAgo(13, 16), action: 'assure', ...FNA_ACTOR },
        { at: daysAgo(12, 9), action: 'dispatch', ...INVOICE_ACTOR },
      ],
      { invoiceNumber: 'ERP-INV-2026-3120', challanNumber: 'CHL-2026-0881' },
    ),
    makeRequest(
      'returned',
      4,
      lines([['SCRATCH100', 5000]]),
      [
        { at: daysAgo(4), action: 'create', ...DEALER_ACTOR },
        {
          at: daysAgo(3, 16),
          action: 'return',
          ...FO_ACTOR,
          note: 'গত মাসের স্টক এখনো শেষ হয়নি। পরিমাণ কমিয়ে আবার দিন।',
        },
      ],
    ),
  ]
}

let requests: LiftingRequest[] = seed()

export async function getRequests(): Promise<LiftingRequest[]> {
  await delay(650)
  return requests
}

/* ---------------------------- queued mutations ---------------------------- */

const settled = new Map<string, LiftingRequest | SrAllocation>()

interface ActorPayload {
  actorPosCode: string
  actorName: { bn: string; en: string }
  actorRole: string
}

function apply(body: LiftingActionRequest & ActorPayload): LiftingRequest {
  const index = requests.findIndex((r) => r.id === body.requestId)
  if (index === -1) throw new ApiError('notFound', 404, 'requestNotFound')
  const current = requests[index]

  const event: LiftingEvent = {
    at: new Date().toISOString(),
    action: body.action,
    actorPosCode: body.actorPosCode,
    actorName: body.actorName,
    actorRole: body.actorRole,
    note: body.note,
  }

  let next: LiftingRequest
  if (body.action === 'return') {
    next = { ...current, stage: 'returned', history: [...current.history, event] }
  } else if (body.action === 'reject') {
    next = { ...current, stage: 'rejected', history: [...current.history, event] }
  } else {
    const transition = forwardTransition(current.stage)
    // The client is one release behind, or two desks acted at once. Either
    // way the request has moved and this action no longer applies.
    if (!transition || transition.action !== body.action) {
      throw new ApiError('conflict', 409, 'stageMoved')
    }
    const withLines =
      body.approvedQuantities === undefined
        ? current.lines
        : current.lines.map((line) => ({
            ...line,
            approved: body.approvedQuantities?.[line.productCode] ?? line.requested,
          }))
    next = {
      ...current,
      stage: transition.to,
      lines: withLines,
      deposit: body.deposit ?? current.deposit,
      invoiceNumber: body.invoiceNumber ?? current.invoiceNumber,
      challanNumber: body.challanNumber ?? current.challanNumber,
      history: [...current.history, event],
    }
    next.value = requestValue(next)
  }

  requests = requests.map((r) => (r.id === next.id ? next : r))
  return next
}

function create(body: NewLiftingRequest & ActorPayload): LiftingRequest {
  const requestLines: LiftingLine[] = Object.entries(body.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => {
      const product = LIFTING_PRODUCTS.find((p) => p.code === code)
      if (!product) throw new ApiError('conflict', 409, 'productUnknown')
      return {
        productCode: product.code,
        productName: product.name,
        requested: quantity,
        unitPrice: product.unitPrice,
      }
    })

  if (requestLines.length === 0) throw new ApiError('conflict', 409, 'demandEmpty')

  const created = makeRequest('requested', 0, requestLines, [
    {
      at: new Date().toISOString(),
      action: 'create',
      actorPosCode: body.actorPosCode,
      actorName: body.actorName,
      actorRole: body.actorRole,
      note: body.note,
    },
  ])
  requests = [created, ...requests]
  return created
}

/**
 * The outbox transport for lifting mutations. Replays a settled response for a
 * repeated idempotency key rather than acting twice — an approval applied
 * twice would advance the chain two desks.
 */
export async function handleLiftingMutation(entry: OutboxEntry): Promise<unknown> {
  const replay = settled.get(entry.id)
  if (replay) return replay

  await delay(800)
  let result: LiftingRequest | SrAllocation
  if (entry.path === '/lifting/requests') {
    result = create(entry.body as NewLiftingRequest & ActorPayload)
  } else if (entry.path === '/sr/allocations') {
    result = allocate(entry.body as NewSrAllocation)
  } else {
    result = apply(entry.body as LiftingActionRequest & ActorPayload)
  }

  settled.set(entry.id, result)
  return result
}

/* ------------------------------- inventory ------------------------------- */

const inventoryLine = (code: string, onHand: number, allocated: number, reorder: number) => {
  const product = LIFTING_PRODUCTS.find((p) => p.code === code)
  if (!product) throw new Error(`unknown product ${code}`)
  return { productCode: code, productName: product.name, onHand, allocated, reorderLevel: reorder }
}

export async function getInventory(scope: InventoryScope): Promise<Inventory> {
  await delay(600)
  const central = scope === 'central'
  return {
    scope,
    location: central
      ? { bn: 'কেন্দ্রীয় গুদাম, ঢাকা', en: 'Central warehouse, Dhaka' }
      : { bn: 'ঢাকা জোনাল গুদাম', en: 'Dhaka zonal warehouse' },
    lines: central
      ? [
          inventoryLine('AGNI', 48_500, 9_200, 20_000),
          inventoryLine('BORNOMALA', 31_000, 4_100, 20_000),
          inventoryLine('TARUNNO', 18_400, 6_600, 20_000),
          inventoryLine('APON', 9_800, 1_200, 10_000),
          inventoryLine('SCRATCH100', 120_000, 18_000, 50_000),
        ]
      : [
          inventoryLine('AGNI', 6_200, 1_300, 3_000),
          inventoryLine('BORNOMALA', 2_400, 900, 3_000),
          inventoryLine('TARUNNO', 4_100, 600, 3_000),
          inventoryLine('APON', 1_150, 200, 1_500),
          inventoryLine('SCRATCH100', 22_000, 5_000, 10_000),
        ],
    movements: [
      { at: daysAgo(0, 10), reference: 'CHL-2026-0881', productCode: 'AGNI', quantity: 1000, direction: 'out' },
      { at: daysAgo(1, 9), reference: 'ERP-INV-2026-3298', productCode: 'APON', quantity: 200, direction: 'out' },
      { at: daysAgo(2, 15), reference: 'GRN-2026-0442', productCode: 'TARUNNO', quantity: 5000, direction: 'in' },
      { at: daysAgo(4, 11), reference: 'CHL-2026-0870', productCode: 'BORNOMALA', quantity: 400, direction: 'out' },
      { at: daysAgo(6, 14), reference: 'GRN-2026-0431', productCode: 'SCRATCH100', quantity: 30_000, direction: 'in' },
    ],
  }
}

/* ---------------------------------- SR ----------------------------------- */

export async function getSrRoute(): Promise<SrRoute> {
  await delay(550)
  return {
    srPosCode: '30010001',
    srName: { bn: 'জাহিদুল ইসলাম', en: 'Zahidul Islam' },
    date: new Date().toISOString().slice(0, 10),
    stops: [
      {
        posCode: '20060794',
        name: { bn: 'সিম ট্রেড কমিউনিকেশন', en: 'SIM Trade Communication' },
        address: { bn: 'মিরপুর-১০, ঢাকা', en: 'Mirpur-10, Dhaka' },
        status: 'visited',
        lastVisitedOn: daysAgo(0, 9, 40),
        outstanding: 0,
      },
      {
        posCode: '20060801',
        name: { bn: 'হাসান টেলিকম', en: 'Hasan Telecom' },
        address: { bn: 'কাজীপাড়া, ঢাকা', en: 'Kazipara, Dhaka' },
        status: 'pending',
        lastVisitedOn: daysAgo(6, 11),
        outstanding: 4_250,
      },
      {
        posCode: '20060812',
        name: { bn: 'নিউ স্টার মোবাইল', en: 'New Star Mobile' },
        address: { bn: 'শেওড়াপাড়া, ঢাকা', en: 'Shewrapara, Dhaka' },
        status: 'pending',
        lastVisitedOn: daysAgo(9, 15),
        outstanding: 0,
      },
      {
        posCode: '20060820',
        name: { bn: 'রূপা টেলিকম', en: 'Rupa Telecom' },
        address: { bn: 'পল্লবী, ঢাকা', en: 'Pallabi, Dhaka' },
        status: 'skipped',
        lastVisitedOn: daysAgo(14, 12),
        outstanding: 1_100,
      },
    ],
  }
}

let allocationSequence = 40

function allocate(body: NewSrAllocation): SrAllocation {
  const lines: SrAllocationLine[] = Object.entries(body.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => {
      const product = LIFTING_PRODUCTS.find((p) => p.code === code)
      if (!product) throw new ApiError('conflict', 409, 'productUnknown')
      return { productCode: code, productName: product.name, quantity }
    })

  if (lines.length === 0) throw new ApiError('conflict', 409, 'allocationEmpty')
  // The dealer's own shelf is finite; a demo ceiling stands in for it.
  const total = lines.reduce((sum, line) => sum + line.quantity, 0)
  if (total > 2000) throw new ApiError('conflict', 409, 'allocationExceedsStock')

  return {
    id: `ALC-2026-${String(allocationSequence++).padStart(4, '0')}`,
    srPosCode: body.srPosCode,
    allocatedOn: new Date().toISOString(),
    lines,
  }
}

/** Test hook — resets module state between cases. */
export function __resetLiftingMock(): void {
  requests = seed()
  settled.clear()
  allocationSequence = 40
}
