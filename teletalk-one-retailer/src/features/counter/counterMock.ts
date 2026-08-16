import { toBengaliDigits } from '../../i18n/format'
import { ApiError } from '../../lib/http'
import type {
  Campaign,
  CommissionStatement,
  CommissionSummary,
  CustomerRecord,
  Offer,
  Outstanding,
  OutstandingItem,
  LedgerEntry,
  NotificationItem,
  Period,
  SalesSummary,
  StatementLine,
  Stock,
  StockType,
  TargetSummary,
} from './counterTypes'

/**
 * In-repo mock of the read services — DMS stock, commission engine, CBS
 * ledger, EC lookup and the notification feed.
 *
 * Dates are generated relative to *now* rather than hard-coded, so the ledger
 * always has a "today" row and the relative-day formatting is actually
 * exercised whenever anyone opens the app. Hard-coded dates rot into a screen
 * where everything happened in August 2026.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const daysAgo = (n: number, hour = 11, minute = 20): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/* -------------------------------- stock --------------------------------- */

const SIM_STOCK: Omit<Stock, 'type'> = {
  total: 148,
  lowThreshold: 50,
  batches: [
    {
      productCode: 'AGNI',
      productName: { bn: 'অগ্নি', en: 'Agni' },
      count: 62,
      firstSerial: '8988015123456780001',
      lastSerial: '8988015123456780062',
      receivedOn: daysAgo(9),
    },
    {
      productCode: 'BORNOMALA',
      productName: { bn: 'বর্ণমালা', en: 'Bornomala' },
      count: 41,
      firstSerial: '8988015123456790001',
      lastSerial: '8988015123456790041',
      receivedOn: daysAgo(9),
    },
    {
      productCode: 'TARUNNO',
      productName: { bn: 'তারুণ্য', en: 'Tarunno' },
      count: 33,
      firstSerial: '8988015123456800001',
      lastSerial: '8988015123456800033',
      receivedOn: daysAgo(2),
    },
    {
      productCode: 'APON',
      productName: { bn: 'আপন', en: 'Apon' },
      count: 12,
      firstSerial: '8988015123456810001',
      lastSerial: '8988015123456810012',
      receivedOn: daysAgo(24),
    },
  ],
}

/** Non-SIM stock: handsets, routers, scratch cards. No serial ranges. */
const PRODUCT_STOCK: Omit<Stock, 'type'> = {
  total: 96,
  lowThreshold: 30,
  batches: [
    {
      productCode: 'SCRATCH100',
      productName: { bn: 'স্ক্র্যাচকার্ড ১০০', en: 'Scratch card ৳100' },
      count: 54,
      receivedOn: daysAgo(6),
    },
    {
      productCode: 'SCRATCH50',
      productName: { bn: 'স্ক্র্যাচকার্ড ৫০', en: 'Scratch card ৳50' },
      count: 30,
      receivedOn: daysAgo(6),
    },
    {
      productCode: 'ROUTER4G',
      productName: { bn: 'ফোরজি রাউটার', en: '4G router' },
      count: 8,
      receivedOn: daysAgo(19),
    },
    {
      productCode: 'HANDSET',
      productName: { bn: 'ফিচার ফোন', en: 'Feature phone' },
      count: 4,
      receivedOn: daysAgo(31),
    },
  ],
}

export async function getStock(type: StockType): Promise<Stock> {
  await delay(600)
  return { type, ...(type === 'sim' ? SIM_STOCK : PRODUCT_STOCK) }
}

/* ----------------------------- commission ------------------------------- */

const COMMISSION_BY_PERIOD: Record<Period, CommissionSummary> = {
  today: {
    period: 'today',
    total: 412.5,
    paid: 262.5,
    pending: 150,
    lines: [
      {
        code: 'activation',
        label: { bn: 'সিম অ্যাক্টিভেশন', en: 'SIM activation' },
        count: 5,
        amount: 250,
      },
      { code: 'recharge', label: { bn: 'রিচার্জ', en: 'Recharge' }, count: 25, amount: 112.5 },
      {
        code: 'productSell',
        label: { bn: 'প্রোডাক্ট বিক্রয়', en: 'Product sales' },
        count: 2,
        amount: 50,
      },
    ],
  },
  week: {
    period: 'week',
    total: 2870,
    paid: 2470,
    pending: 400,
    lines: [
      {
        code: 'activation',
        label: { bn: 'সিম অ্যাক্টিভেশন', en: 'SIM activation' },
        count: 34,
        amount: 1700,
      },
      { code: 'recharge', label: { bn: 'রিচার্জ', en: 'Recharge' }, count: 186, amount: 837 },
      {
        code: 'productSell',
        label: { bn: 'প্রোডাক্ট বিক্রয়', en: 'Product sales' },
        count: 13,
        amount: 333,
      },
    ],
  },
  month: {
    period: 'month',
    total: 11240,
    paid: 9840,
    pending: 1400,
    lines: [
      {
        code: 'activation',
        label: { bn: 'সিম অ্যাক্টিভেশন', en: 'SIM activation' },
        count: 132,
        amount: 6600,
      },
      { code: 'recharge', label: { bn: 'রিচার্জ', en: 'Recharge' }, count: 742, amount: 3339 },
      {
        code: 'productSell',
        label: { bn: 'প্রোডাক্ট বিক্রয়', en: 'Product sales' },
        count: 51,
        amount: 1051,
      },
      {
        code: 'target',
        label: { bn: 'টার্গেট বোনাস', en: 'Target bonus' },
        count: 1,
        amount: 250,
      },
    ],
  },
}

export async function getCommission(period: Period): Promise<CommissionSummary> {
  await delay(550)
  return COMMISSION_BY_PERIOD[period]
}

const MONTHS = [
  'জানু',
  'ফেব',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগ',
  'সেপ',
  'অক্টো',
  'নভে',
  'ডিসে',
]

function monthLabel(offset: number): { period: string; label: { bn: string; en: string } } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  const en = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return {
    period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    // Server-owned display strings arrive already localised, digits included —
    // a Bangla label with a Latin year is exactly the mixed-language screen the
    // bilingual rule exists to prevent.
    label: { bn: `${MONTHS[d.getMonth()]} ${toBengaliDigits(String(d.getFullYear()))}`, en },
  }
}

export async function getCommissionStatement(): Promise<CommissionStatement> {
  await delay(600)
  const rows = [
    { earned: 11_240, paid: 9_840, ref: 'STL-2026-0812' },
    { earned: 12_980, paid: 12_980, ref: 'STL-2026-0714' },
    { earned: 10_450, paid: 10_450, ref: 'STL-2026-0613' },
    { earned: 9_870, paid: 9_870, ref: 'STL-2026-0515' },
  ]
  const lines: StatementLine[] = rows.map((row, index) => {
    const { period, label } = monthLabel(index)
    const settled = row.earned === row.paid
    return {
      period,
      label,
      earned: row.earned,
      paid: row.paid,
      // The reference is what a retailer quotes when they ring to ask where
      // the money went, so an unsettled month deliberately has none.
      paidOn: settled ? daysAgo(index * 30 + 4, 10) : undefined,
      reference: settled ? row.ref : undefined,
      status: settled ? 'paid' : 'pending',
    }
  })
  return {
    totalEarned: rows.reduce((sum, r) => sum + r.earned, 0),
    totalPaid: rows.reduce((sum, r) => sum + r.paid, 0),
    lines,
  }
}

/* ----------------------------- outstanding ------------------------------ */

export async function getOutstanding(): Promise<Outstanding> {
  await delay(550)
  const items: OutstandingItem[] = [
    {
      id: 'ERP-INV-2026-3341',
      what: { bn: 'ইআরপি ইনভয়েস — অগ্নি ৮০০', en: 'ERP invoice — Agni 800' },
      amount: 128_000,
      dueOn: daysAgo(-6, 10),
      overdueDays: 0,
    },
    {
      id: 'ERP-INV-2026-3298',
      what: { bn: 'ইআরপি ইনভয়েস — আপন ও বর্ণমালা', en: 'ERP invoice — Apon & Bornomala' },
      amount: 88_000,
      dueOn: daysAgo(3, 10),
      overdueDays: 3,
    },
    {
      id: 'ADJ-2026-0119',
      what: { bn: 'পিওএসএম সমন্বয়', en: 'POSM adjustment' },
      amount: 4_500,
      dueOn: daysAgo(21, 10),
      overdueDays: 21,
    },
  ]
  return {
    total: items.reduce((sum, i) => sum + i.amount, 0),
    overdue: items.filter((i) => i.overdueDays > 0).reduce((sum, i) => sum + i.amount, 0),
    creditLimit: 300_000,
    items,
  }
}

/* -------------------------------- target -------------------------------- */

export async function getTarget(): Promise<TargetSummary> {
  await delay(500)
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    period: monthLabel(0).period,
    daysLeft: Math.max(0, endOfMonth.getDate() - now.getDate()),
    lines: [
      {
        code: 'activation',
        label: { bn: 'সিম অ্যাক্টিভেশন', en: 'SIM activation' },
        target: 150,
        achieved: 132,
        unit: 'count',
      },
      {
        code: 'recharge',
        label: { bn: 'রিচার্জ', en: 'Recharge' },
        target: 120_000,
        achieved: 96_400,
        unit: 'money',
      },
      {
        code: 'productSell',
        label: { bn: 'প্রোডাক্ট বিক্রয়', en: 'Product sales' },
        target: 40,
        achieved: 51,
        unit: 'count',
      },
    ],
  }
}

/* --------------------------- campaigns & offers -------------------------- */

export async function getCampaigns(): Promise<Campaign[]> {
  await delay(520)
  return [
    {
      id: 'CMP-2026-018',
      name: { bn: 'তারুণ্য অ্যাক্টিভেশন বোনাস', en: 'Tarunno activation bonus' },
      body: {
        bn: 'তারুণ্য প্যাকেজের প্রতিটি অ্যাক্টিভেশনে অতিরিক্ত ৳২০ কমিশন।',
        en: 'An extra ৳20 commission on every Tarunno activation.',
      },
      startsOn: daysAgo(12),
      endsOn: daysAgo(-18),
      enrolled: true,
      progress: { target: 60, achieved: 41, rewardAmount: 1_200 },
    },
    {
      id: 'CMP-2026-017',
      name: { bn: 'ঈদ রিচার্জ ক্যাম্পেইন', en: 'Eid recharge campaign' },
      body: {
        bn: 'মাসে ৳১,০০,০০০ রিচার্জ করলে ৳২,৫০০ বোনাস।',
        en: '৳2,500 bonus on ৳100,000 of recharge in the month.',
      },
      startsOn: daysAgo(20),
      endsOn: daysAgo(-9),
      enrolled: true,
      progress: { target: 100_000, achieved: 96_400, rewardAmount: 2_500 },
    },
    {
      id: 'CMP-2026-015',
      name: { bn: 'নতুন রিটেইলার রেফারেল', en: 'New retailer referral' },
      body: {
        bn: 'নতুন রিটেইলার আনলে ৳৫০০ — শুধু ডিলারদের জন্য।',
        en: '৳500 per new retailer enrolled. Dealers only.',
      },
      startsOn: daysAgo(40),
      endsOn: daysAgo(-40),
      enrolled: false,
    },
  ]
}

export async function getOffers(): Promise<Offer[]> {
  await delay(480)
  return [
    {
      id: 'OFR-101',
      name: { bn: '৩০ জিবি ৩০ দিন', en: '30GB for 30 days' },
      body: {
        bn: '৩০ দিনের মেয়াদে ৩০ জিবি ইন্টারনেট।',
        en: '30GB of internet, valid 30 days.',
      },
      price: 398,
      validity: { bn: '৩০ দিন', en: '30 days' },
      code: '*111*398#',
    },
    {
      id: 'OFR-102',
      name: { bn: 'বান্ডেল ৪৯', en: 'Bundle 49' },
      body: {
        bn: '৩ জিবি ও ৬০ মিনিট, ৭ দিনের মেয়াদ।',
        en: '3GB and 60 minutes, valid 7 days.',
      },
      price: 49,
      validity: { bn: '৭ দিন', en: '7 days' },
      code: '*111*49#',
    },
    {
      id: 'OFR-103',
      name: { bn: 'রাতের ইন্টারনেট', en: 'Night internet' },
      body: {
        bn: 'রাত ১২টা থেকে সকাল ৮টা পর্যন্ত ৫ জিবি।',
        en: '5GB between midnight and 8am.',
      },
      price: 99,
      validity: { bn: '৭ দিন', en: '7 days' },
      code: '*111*99#',
    },
  ]
}

/* ------------------------------- ledger --------------------------------- */

const LEDGER: LedgerEntry[] = [
  {
    id: 'ACT20268841',
    kind: 'activation',
    msisdn: '01512345678',
    amount: 200,
    at: daysAgo(0, 12, 40),
    state: 'settled',
  },
  {
    id: 'RCH20268840',
    kind: 'recharge',
    msisdn: '01512345678',
    amount: 50,
    at: daysAgo(0, 12, 42),
    state: 'settled',
  },
  {
    id: 'RCH20268839',
    kind: 'recharge',
    msisdn: '01718004411',
    amount: 200,
    at: daysAgo(0, 10, 15),
    state: 'settled',
  },
  {
    id: 'REP20268836',
    kind: 'replacement',
    msisdn: '01555010101',
    at: daysAgo(0, 9, 5),
    state: 'failed',
    note: {
      bn: 'আঙুলের ছাপ মেলেনি। বিভিএস ডিভাইসে আবার ছাপ নিন।',
      en: 'The fingerprint did not match. Capture it again on the BVS device.',
    },
  },
  {
    id: 'MNP20268830',
    kind: 'portIn',
    msisdn: '01711223344',
    at: daysAgo(1, 16, 30),
    state: 'pending',
    note: {
      bn: 'দাতা অপারেটরের অনুমোদনের অপেক্ষায়।',
      en: 'Awaiting the donor operator’s clearance.',
    },
  },
  {
    id: 'RCH20268829',
    kind: 'recharge',
    msisdn: '01912004455',
    amount: 100,
    at: daysAgo(1, 14, 2),
    state: 'reversed',
    note: {
      bn: 'গ্রাহকের অনুরোধে ফেরত দেওয়া হয়েছে।',
      en: 'Reversed at the customer’s request.',
    },
  },
  {
    id: 'ACT20268820',
    kind: 'activation',
    msisdn: '01566778899',
    amount: 250,
    at: daysAgo(2, 11, 12),
    state: 'settled',
  },
  {
    id: 'PRD20268812',
    kind: 'productSell',
    msisdn: '01512345678',
    amount: 500,
    at: daysAgo(3, 15, 48),
    state: 'settled',
  },
]

export async function getLedger(): Promise<LedgerEntry[]> {
  await delay(700)
  return LEDGER
}

/* -------------------------------- sales --------------------------------- */

export async function getSales(period: Period): Promise<SalesSummary> {
  await delay(650)
  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30
  // A flat line would hide the one thing this screen is for — seeing which
  // days the outlet actually sold on.
  const shape = [7, 4, 9, 12, 6, 3, 11, 8, 5, 10]
  const points = Array.from({ length: Math.min(days, 14) }, (_, i) => {
    const activations = shape[i % shape.length]
    return {
      day: daysAgo(Math.min(days, 14) - 1 - i, 12, 0),
      activations,
      rechargeAmount: activations * 145 + 320,
    }
  })
  const activations = points.reduce((sum, p) => sum + p.activations, 0)
  const rechargeAmount = points.reduce((sum, p) => sum + p.rechargeAmount, 0)

  return {
    period,
    activations,
    recharges: activations * 6,
    rechargeAmount,
    commission: COMMISSION_BY_PERIOD[period].total,
    target: period === 'month' ? 150 : undefined,
    points,
  }
}

/* ------------------------------- customer ------------------------------- */

const CUSTOMERS: CustomerRecord[] = [
  {
    msisdn: '01512345678',
    name: { bn: 'মোছাঃ রেহানা পারভীন', en: 'Most. Rehana Parvin' },
    nid: '1234567890',
    status: 'active',
    productName: { bn: 'অগ্নি', en: 'Agni' },
    activatedOn: daysAgo(0, 12, 40),
  },
  {
    msisdn: '01566778899',
    name: { bn: 'মোঃ সাইফুল ইসলাম', en: 'Md. Saiful Islam' },
    nid: '9876543210123',
    status: 'active',
    productName: { bn: 'আপন', en: 'Apon' },
    activatedOn: daysAgo(2, 11, 12),
  },
  {
    msisdn: '01555010101',
    name: { bn: 'শামীমা আক্তার', en: 'Shamima Akter' },
    nid: '19911234567890123',
    status: 'barred',
    productName: { bn: 'বর্ণমালা', en: 'Bornomala' },
    activatedOn: daysAgo(430, 10, 0),
  },
]

/**
 * Lookup by MSISDN or NID. Deliberately exact-match only: a prefix search over
 * a subscriber base is a data-protection incident waiting to be demonstrated,
 * and the counter always has the whole number in front of it.
 */
export async function searchCustomers(query: string): Promise<CustomerRecord[]> {
  await delay(700)
  if (query.length < 10) throw new ApiError('generic', 400, 'searchTooShort')
  return CUSTOMERS.filter((c) => c.msisdn === query || c.nid === query)
}

/* ----------------------------- notifications ---------------------------- */

let notifications: NotificationItem[] = [
  {
    id: 'N-1041',
    title: { bn: 'সিম স্টক কমে আসছে', en: 'SIM stock running low' },
    body: {
      bn: 'আপন প্যাকেজের স্টক ১২টিতে নেমেছে। রিকুইজিশন দিন।',
      en: 'Apon stock is down to 12. Raise a requisition.',
    },
    at: daysAgo(0, 9, 30),
    read: false,
    severity: 'action',
  },
  {
    id: 'N-1040',
    title: { bn: 'কমিশন জমা হয়েছে', en: 'Commission credited' },
    body: {
      bn: 'গত সপ্তাহের কমিশন ৳২,৪৭০ আপনার টেলিচার্জ ব্যালান্সে যোগ হয়েছে।',
      en: '৳2,470 of last week’s commission has been added to your TeleCharge balance.',
    },
    at: daysAgo(1, 8, 0),
    read: false,
    severity: 'info',
  },
  {
    id: 'N-1039',
    title: { bn: 'বিভিএস রক্ষণাবেক্ষণ', en: 'BVS maintenance' },
    body: {
      bn: 'শুক্রবার রাত ১২টা থেকে ৩টা পর্যন্ত অ্যাক্টিভেশন বন্ধ থাকবে।',
      en: 'Activation will be unavailable Friday from 12am to 3am.',
    },
    at: daysAgo(2, 17, 45),
    read: false,
    severity: 'warn',
  },
  {
    id: 'N-1038',
    title: { bn: 'নতুন ক্যাম্পেইন', en: 'New campaign' },
    body: {
      bn: 'তারুণ্য প্যাকেজে অ্যাক্টিভেশন কমিশন ৳৭০ করা হয়েছে।',
      en: 'Activation commission on Tarunno has been raised to ৳70.',
    },
    at: daysAgo(5, 10, 0),
    read: true,
    severity: 'info',
  },
]

export async function getNotifications(): Promise<NotificationItem[]> {
  await delay(450)
  return notifications
}

export async function markNotificationsRead(ids: string[]): Promise<NotificationItem[]> {
  await delay(300)
  notifications = notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
  return notifications
}

/** Test hook — resets module state between cases. */
export function __resetCounterMock(): void {
  notifications = notifications.map((n) => ({ ...n, read: n.id === 'N-1038' }))
}
