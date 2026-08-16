import { ApiError } from '../../lib/http'
import type { OutboxEntry } from '../../lib/outbox'
import { LIFTING_PRODUCTS } from '../lifting/liftingMock'
import type {
  Collection,
  Complaint,
  ComplaintCategory,
  CustomerProfile,
  Movement,
  NewCollection,
  NewComplaint,
  NewMovement,
  NewReconcile,
  NewRequisition,
  Performance,
  ReconcileLine,
  ReconcileResult,
  Requisition,
  RequisitionAction,
  RequisitionLine,
  Settlement,
  SubsidySummary,
  Wallet,
} from './opsTypes'

/**
 * In-repo mock for outlet operations.
 *
 * Same rules as the other mocks: dates are relative to now so the SLA clocks
 * and "3 days late" figures are live rather than frozen, and every named
 * failure path is reachable so it can be given a remedy before the real
 * integration exists.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const hoursFromNow = (h: number): string => new Date(Date.now() + h * 3_600_000).toISOString()
const daysAgo = (n: number, hour = 11): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}

const product = (code: string) => {
  const found = LIFTING_PRODUCTS.find((p) => p.code === code)
  if (!found) throw new ApiError('conflict', 409, 'productUnknown')
  return found
}

/* ----------------------------- requisition ------------------------------ */

const OUTLET = {
  posCode: '20060794',
  name: { bn: 'সিম ট্রেড কমিউনিকেশন', en: 'SIM Trade Communication' },
}

let requisitionSequence = 30

function requisitionLines(spec: [string, number, number?][]): RequisitionLine[] {
  return spec.map(([code, requested, approved]) => ({
    productCode: code,
    productName: product(code).name,
    requested,
    approved,
  }))
}

function seedRequisitions(): Requisition[] {
  requisitionSequence = 30
  return [
    {
      id: 'RQ-2026-0027',
      stage: 'raised',
      outletPosCode: OUTLET.posCode,
      outletName: OUTLET.name,
      raisedOn: daysAgo(1),
      lines: requisitionLines([['SCRATCH100', 200]]),
      history: [
        {
          at: daysAgo(1),
          action: 'create',
          actorPosCode: OUTLET.posCode,
          actorName: OUTLET.name,
          note: 'স্ক্র্যাচকার্ড শেষ হয়ে আসছে',
        },
      ],
    },
    {
      id: 'RQ-2026-0025',
      stage: 'approved',
      outletPosCode: OUTLET.posCode,
      outletName: OUTLET.name,
      raisedOn: daysAgo(4),
      lines: requisitionLines([['AGNI', 100, 60]]),
      history: [
        { at: daysAgo(4), action: 'create', actorPosCode: OUTLET.posCode, actorName: OUTLET.name },
        {
          at: daysAgo(3),
          action: 'approve',
          actorPosCode: '30090001',
          actorName: { bn: 'সিএসআইএম ডেস্ক', en: 'CSIM desk' },
          note: 'কেন্দ্রীয় স্টক অনুযায়ী ৬০ ছাড়া হলো',
        },
      ],
    },
    {
      id: 'RQ-2026-0019',
      stage: 'fulfilled',
      outletPosCode: OUTLET.posCode,
      outletName: OUTLET.name,
      raisedOn: daysAgo(11),
      lines: requisitionLines([['TARUNNO', 50, 50]]),
      history: [
        { at: daysAgo(11), action: 'create', actorPosCode: OUTLET.posCode, actorName: OUTLET.name },
        {
          at: daysAgo(10),
          action: 'approve',
          actorPosCode: '30090001',
          actorName: { bn: 'সিএসআইএম ডেস্ক', en: 'CSIM desk' },
        },
        {
          at: daysAgo(9),
          action: 'fulfil',
          actorPosCode: '30060001',
          actorName: { bn: 'ইনভেন্টরি ডেস্ক', en: 'Inventory desk' },
        },
      ],
    },
  ]
}

let requisitions: Requisition[] = seedRequisitions()

export async function getRequisitions(): Promise<Requisition[]> {
  await delay(600)
  return requisitions
}

function createRequisition(body: NewRequisition & { actorPosCode: string }): Requisition {
  const lines = Object.entries(body.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => ({
      productCode: code,
      productName: product(code).name,
      requested: quantity,
    }))
  if (lines.length === 0) throw new ApiError('conflict', 409, 'demandEmpty')

  const created: Requisition = {
    id: `RQ-2026-${String(requisitionSequence++).padStart(4, '0')}`,
    stage: 'raised',
    outletPosCode: body.actorPosCode,
    outletName: OUTLET.name,
    raisedOn: new Date().toISOString(),
    lines,
    history: [
      {
        at: new Date().toISOString(),
        action: 'create',
        actorPosCode: body.actorPosCode,
        actorName: OUTLET.name,
        note: body.note,
      },
    ],
  }
  requisitions = [created, ...requisitions]
  return created
}

function actOnRequisition(body: RequisitionAction & { actorPosCode: string }): Requisition {
  const current = requisitions.find((r) => r.id === body.requisitionId)
  if (!current) throw new ApiError('notFound', 404, 'requestNotFound')

  const stage =
    body.action === 'approve' ? 'approved' : body.action === 'fulfil' ? 'fulfilled' : 'rejected'
  const next: Requisition = {
    ...current,
    stage,
    lines:
      body.approvedQuantities === undefined
        ? current.lines
        : current.lines.map((line) => ({
            ...line,
            approved: body.approvedQuantities?.[line.productCode] ?? line.requested,
          })),
    history: [
      ...current.history,
      {
        at: new Date().toISOString(),
        action: body.action,
        actorPosCode: body.actorPosCode,
        actorName: { bn: 'অনুমোদনকারী', en: 'Approver' },
        note: body.note,
      },
    ],
  }
  requisitions = requisitions.map((r) => (r.id === next.id ? next : r))
  return next
}

/* ------------------------------ complaints ------------------------------ */

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  {
    code: 'activationFailed',
    label: { bn: 'অ্যাক্টিভেশন হয়নি', en: 'Activation did not complete' },
    slaHours: 24,
  },
  {
    code: 'rechargeMissing',
    label: { bn: 'রিচার্জ পৌঁছায়নি', en: 'Recharge not received' },
    slaHours: 4,
  },
  {
    code: 'commissionMissing',
    label: { bn: 'কমিশন জমা হয়নি', en: 'Commission not credited' },
    slaHours: 72,
  },
  { code: 'stockShortage', label: { bn: 'স্টকে ঘাটতি', en: 'Stock shortage' }, slaHours: 48 },
  { code: 'deviceIssue', label: { bn: 'ডিভাইস সমস্যা', en: 'Device problem' }, slaHours: 48 },
  { code: 'other', label: { bn: 'অন্যান্য', en: 'Something else' }, slaHours: 72 },
]

let complaintSequence = 400

function seedComplaints(): Complaint[] {
  complaintSequence = 400
  return [
    {
      id: 'CMP-2026-0398',
      category: 'rechargeMissing',
      categoryLabel: COMPLAINT_CATEGORIES[1].label,
      subject: 'রিচার্জ কেটেছে কিন্তু গ্রাহক পাননি',
      msisdn: '01712345678',
      status: 'inProgress',
      raisedOn: daysAgo(0, 9),
      slaDueOn: hoursFromNow(2),
      updates: [
        {
          at: daysAgo(0, 10),
          by: { bn: 'হেল্পডেস্ক', en: 'Helpdesk' },
          note: 'Telepay-তে খোঁজ নেওয়া হচ্ছে।',
        },
      ],
    },
    {
      id: 'CMP-2026-0391',
      category: 'commissionMissing',
      categoryLabel: COMPLAINT_CATEGORIES[2].label,
      subject: 'গত মাসের কমিশন জমা হয়নি',
      status: 'open',
      raisedOn: daysAgo(2, 14),
      // Deliberately in the past: an SLA that has already blown is the state
      // the tracking screen exists to make impossible to miss.
      slaDueOn: hoursFromNow(-6),
      updates: [],
    },
    {
      id: 'CMP-2026-0377',
      category: 'deviceIssue',
      categoryLabel: COMPLAINT_CATEGORIES[4].label,
      subject: 'বিভিএস ডিভাইস চালু হচ্ছে না',
      status: 'resolved',
      raisedOn: daysAgo(9, 11),
      slaDueOn: daysAgo(7, 11),
      resolvedOn: daysAgo(8, 16),
      updates: [
        {
          at: daysAgo(8, 16),
          by: { bn: 'ফিল্ড সাপোর্ট', en: 'Field support' },
          note: 'ডিভাইস বদলে দেওয়া হয়েছে।',
        },
      ],
    },
  ]
}

let complaints: Complaint[] = seedComplaints()

export async function getComplaints(): Promise<Complaint[]> {
  await delay(600)
  return complaints
}

function createComplaint(body: NewComplaint): Complaint {
  const category = COMPLAINT_CATEGORIES.find((c) => c.code === body.category)
  if (!category) throw new ApiError('conflict', 409, 'categoryUnknown')

  const created: Complaint = {
    id: `CMP-2026-${String(complaintSequence++).padStart(4, '0')}`,
    category: category.code,
    categoryLabel: category.label,
    subject: body.subject,
    msisdn: body.msisdn || undefined,
    status: 'open',
    raisedOn: new Date().toISOString(),
    slaDueOn: hoursFromNow(category.slaHours),
    updates: body.detail ? [{ at: new Date().toISOString(), by: OUTLET.name, note: body.detail }] : [],
  }
  complaints = [created, ...complaints]
  return created
}

/* -------------------------------- wallet -------------------------------- */

export async function getWallet(): Promise<Wallet> {
  await delay(550)
  const entries = [
    { id: 'W-8841', at: daysAgo(0, 12), kind: 'sale' as const, amount: -50, reference: 'RCH20268840' },
    { id: 'W-8840', at: daysAgo(0, 10), kind: 'sale' as const, amount: -200, reference: 'RCH20268839' },
    { id: 'W-8838', at: daysAgo(1, 9), kind: 'topUp' as const, amount: 5000, reference: 'TOP-2026-4411' },
    { id: 'W-8830', at: daysAgo(2, 16), kind: 'commission' as const, amount: 2470, reference: 'STL-2026-0714' },
    { id: 'W-8821', at: daysAgo(4, 11), kind: 'adjustment' as const, amount: -120, reference: 'ADJ-2026-0119' },
  ]
  let running = 4_820.5
  const withBalance = entries.map((entry) => {
    const balanceAfter = running
    running -= entry.amount
    return { ...entry, balanceAfter }
  })
  return { balance: 4_820.5, creditLimit: 10_000, entries: withBalance }
}

function collect(body: NewCollection): Collection {
  if (body.amount <= 0) throw new ApiError('conflict', 409, 'amountRequired')
  if (body.amount > 100_000) throw new ApiError('forbidden', 403, 'collectionTooLarge')
  return {
    id: `COL-2026-${String(Math.floor(body.amount)).slice(0, 4).padStart(4, '0')}`,
    fromPosCode: body.fromPosCode,
    amount: body.amount,
    method: body.method,
    collectedOn: new Date().toISOString(),
  }
}

/* ----------------------------- settlement ------------------------------- */

export async function getSettlements(): Promise<Settlement[]> {
  await delay(600)
  return [
    {
      id: 'STL-2026-0812',
      period: { bn: 'আগ ২০২৬', en: 'Aug 2026' },
      grossSales: 184_500,
      commission: 11_240,
      deductions: 1_400,
      net: 9_840,
      status: 'pending',
    },
    {
      id: 'STL-2026-0714',
      period: { bn: 'জুলাই ২০২৬', en: 'Jul 2026' },
      grossSales: 210_300,
      commission: 12_980,
      deductions: 0,
      net: 12_980,
      status: 'settled',
      settledOn: daysAgo(33),
      reference: 'BFT-2026-77120',
    },
    {
      id: 'STL-2026-0613',
      period: { bn: 'জুন ২০২৬', en: 'Jun 2026' },
      grossSales: 176_900,
      commission: 10_450,
      deductions: 300,
      net: 10_150,
      status: 'settled',
      settledOn: daysAgo(64),
      reference: 'BFT-2026-70884',
    },
  ]
}

/* ------------------------------- subsidy -------------------------------- */

export async function getSubsidy(): Promise<SubsidySummary> {
  await delay(520)
  const items = [
    {
      code: 'ruralActivation',
      label: { bn: 'গ্রামীণ অ্যাক্টিভেশন ভর্তুকি', en: 'Rural activation subsidy' },
      basis: 'perActivation' as const,
      rate: 30,
      earned: 2_760,
      status: 'pending' as const,
    },
    {
      code: 'posmUpkeep',
      label: { bn: 'পিওএসএম রক্ষণাবেক্ষণ', en: 'POSM upkeep' },
      basis: 'monthly' as const,
      rate: 500,
      earned: 500,
      status: 'paid' as const,
    },
    {
      code: 'connectivity',
      label: { bn: 'ইন্টারনেট ভাতা', en: 'Connectivity allowance' },
      basis: 'monthly' as const,
      rate: 300,
      earned: 300,
      status: 'paid' as const,
    },
  ]
  return {
    total: items.reduce((s, i) => s + i.earned, 0),
    paid: items.filter((i) => i.status === 'paid').reduce((s, i) => s + i.earned, 0),
    pending: items.filter((i) => i.status === 'pending').reduce((s, i) => s + i.earned, 0),
    items,
  }
}

/* --------------------------- stock movements ---------------------------- */

export const RETURN_REASONS = ['damaged', 'expired', 'wrongProduct', 'slowMoving'] as const

export async function getReconcileLines(): Promise<ReconcileLine[]> {
  await delay(550)
  return [
    { productCode: 'AGNI', productName: product('AGNI').name, system: 62 },
    { productCode: 'BORNOMALA', productName: product('BORNOMALA').name, system: 41 },
    { productCode: 'TARUNNO', productName: product('TARUNNO').name, system: 33 },
    { productCode: 'APON', productName: product('APON').name, system: 12 },
    { productCode: 'SCRATCH100', productName: product('SCRATCH100').name, system: 54 },
  ]
}

let movementSequence = 70

function move(body: NewMovement): Movement {
  const lines = body.lines.filter((l) => l.quantity > 0)
  if (lines.length === 0) throw new ApiError('conflict', 409, 'movementEmpty')
  if (body.kind === 'return' && !body.reasonCode) {
    throw new ApiError('conflict', 409, 'reasonRequired')
  }
  if (body.kind === 'transfer' && !body.toPosCode) {
    throw new ApiError('conflict', 409, 'destinationRequired')
  }
  // A transfer to yourself is a typo, and one that would quietly balance.
  if (body.kind === 'transfer' && body.toPosCode === OUTLET.posCode) {
    throw new ApiError('conflict', 409, 'destinationSameOutlet')
  }
  return {
    id: `MOV-2026-${String(movementSequence++).padStart(4, '0')}`,
    kind: body.kind,
    raisedOn: new Date().toISOString(),
    status: 'submitted',
    lines,
  }
}

function reconcile(body: NewReconcile, lines: ReconcileLine[]): ReconcileResult {
  const variance: Record<string, number> = {}
  for (const line of lines) {
    const counted = body.counts[line.productCode]
    if (counted === undefined) continue
    variance[line.productCode] = counted - line.system
  }
  if (Object.keys(variance).length === 0) throw new ApiError('conflict', 409, 'countEmpty')
  return {
    id: `RCN-2026-${String(movementSequence++).padStart(4, '0')}`,
    countedOn: new Date().toISOString(),
    variance,
  }
}

/* ----------------------------- customer 360 ----------------------------- */

export async function getCustomerProfile(msisdn: string): Promise<CustomerProfile> {
  await delay(750)
  if (msisdn.endsWith('00')) throw new ApiError('notFound', 404, 'msisdnNotFound')
  return {
    msisdn,
    name: { bn: 'মোছাঃ রেহানা পারভীন', en: 'Most. Rehana Parvin' },
    nid: '1234567890',
    balance: 47.5,
    planName: { bn: 'অগ্নি', en: 'Agni' },
    lastRechargeOn: daysAgo(0, 12),
    rechargeLast30Days: 640,
    sims: [
      {
        msisdn,
        status: 'active',
        productName: { bn: 'অগ্নি', en: 'Agni' },
        activatedOn: daysAgo(0, 12),
      },
      {
        msisdn: '01598877665',
        status: 'inactive',
        productName: { bn: 'বর্ণমালা', en: 'Bornomala' },
        activatedOn: daysAgo(420, 10),
      },
    ],
    recentTransactions: [
      {
        id: 'RCH20268840',
        kind: 'recharge',
        msisdn,
        amount: 50,
        at: daysAgo(0, 12),
        state: 'settled',
      },
      {
        id: 'ACT20268841',
        kind: 'activation',
        msisdn,
        amount: 200,
        at: daysAgo(0, 12),
        state: 'settled',
      },
    ],
  }
}

/* ----------------------------- performance ------------------------------ */

export async function getPerformance(): Promise<Performance> {
  await delay(600)
  return {
    period: { bn: 'আগ ২০২৬', en: 'Aug 2026' },
    overall: 78,
    rank: 14,
    ofOutlets: 212,
    scores: [
      {
        code: 'activation',
        label: { bn: 'অ্যাক্টিভেশন', en: 'Activation' },
        score: 88,
        max: 100,
        trend: 'up',
      },
      {
        code: 'recharge',
        label: { bn: 'রিচার্জ', en: 'Recharge' },
        score: 80,
        max: 100,
        trend: 'flat',
      },
      {
        code: 'quality',
        label: { bn: 'কেওয়াইসি মান', en: 'KYC quality' },
        score: 94,
        max: 100,
        trend: 'up',
      },
      {
        code: 'compliance',
        label: { bn: 'সময়মতো জমা', en: 'On-time deposit' },
        score: 52,
        max: 100,
        trend: 'down',
      },
    ],
  }
}

/* ---------------------------- queued mutations --------------------------- */

const settled = new Map<string, unknown>()

/** The outbox transport for every mutation in this module. */
export async function handleOpsMutation(entry: OutboxEntry): Promise<unknown> {
  const replay = settled.get(entry.id)
  if (replay) return replay

  await delay(750)
  const body = entry.body as Record<string, unknown>
  let result: unknown

  switch (entry.path) {
    case '/requisitions':
      result = createRequisition(body as unknown as NewRequisition & { actorPosCode: string })
      break
    case '/requisitions/actions':
      result = actOnRequisition(body as unknown as RequisitionAction & { actorPosCode: string })
      break
    case '/complaints':
      result = createComplaint(body as unknown as NewComplaint)
      break
    case '/wallet/collect':
      result = collect(body as unknown as NewCollection)
      break
    case '/stock/movements':
      result = move(body as unknown as NewMovement)
      break
    case '/stock/reconcile':
      result = reconcile(body as unknown as NewReconcile, await getReconcileLines())
      break
    default:
      throw new ApiError('notFound', 404, 'generic')
  }

  settled.set(entry.id, result)
  return result
}

/** Test hook — resets module state between cases. */
export function __resetOpsMock(): void {
  requisitions = seedRequisitions()
  complaints = seedComplaints()
  movementSequence = 70
  settled.clear()
}
