import type { Role, Session } from './authTypes'
import { CAPABILITIES_BY_ROLE } from './roles'

/**
 * One demo account per role, so every capability set in the org model can
 * actually be signed into and reviewed. Development fixtures only — the real
 * service resolves role and capabilities from the POS/user record.
 */
export interface DemoAccount {
  posCode: string
  role: Role
  session: Omit<Session, 'capabilities' | 'deviceTrusted'>
}

type Draft = {
  posCode: string
  role: Role
  name: [string, string]
  owner: [string, string]
  zone: [string, string]
  territory: [string, string]
  msisdn: string
  address: [string, string]
  enlistedOn: string
  tier?: Session['tier']
  stats: Session['stats']
}

const DRAFTS: Draft[] = [
  {
    posCode: '20060794',
    role: 'retailer',
    name: ['সিম ট্রেড কমিউনিকেশন', 'Sim Trade Communication'],
    owner: ['মোঃ রফিকুল ইসলাম', 'Md. Rafiqul Islam'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['মিরপুর-১০', 'Mirpur-10'],
    msisdn: '8801714080287',
    address: [
      'দোকান নং ১২, শাহ আলী মার্কেট, মিরপুর-১০, ঢাকা-১২১৬',
      'Shop 12, Shah Ali Market, Mirpur-10, Dhaka-1216',
    ],
    enlistedOn: '2019-11-04',
    tier: 'gold',
    stats: { balance: 11731.04, commissionToday: 11.22, simStock: 148 },
  },
  {
    posCode: '30010001',
    role: 'sr',
    name: ['রুট ৪ — মিরপুর', 'Route 4 — Mirpur'],
    owner: ['আব্দুল করিম', 'Abdul Karim'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['মিরপুর', 'Mirpur'],
    msisdn: '8801715330912',
    address: ['মিরপুর রুট ৪, ঢাকা', 'Mirpur Route 4, Dhaka'],
    enlistedOn: '2021-03-17',
    stats: { simStock: 620, pendingApprovals: 3 },
  },
  {
    posCode: '30020001',
    role: 'dealer',
    name: ['মেসার্স হক এন্টারপ্রাইজ', 'M/S Haque Enterprise'],
    owner: ['শাহিদুল হক', 'Shahidul Haque'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['মিরপুর ও পল্লবী', 'Mirpur & Pallabi'],
    msisdn: '8801711204455',
    address: ['১০৫ মিরপুর রোড, ঢাকা-১২১৬', '105 Mirpur Road, Dhaka-1216'],
    enlistedOn: '2015-06-22',
    stats: { balance: 842300.5, commissionToday: 4820.75, simStock: 9450, pendingApprovals: 7 },
  },
  {
    posCode: '30030001',
    role: 'fieldOfficer',
    name: ['মাঠ কর্মকর্তা — মিরপুর', 'Field Officer — Mirpur'],
    owner: ['তানভীর আহমেদ', 'Tanvir Ahmed'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['মিরপুর', 'Mirpur'],
    msisdn: '8801711556677',
    address: ['টেলিটক জোনাল অফিস, ঢাকা', 'Teletalk Zonal Office, Dhaka'],
    enlistedOn: '2018-01-09',
    stats: { pendingApprovals: 12 },
  },
  {
    posCode: '30040001',
    role: 'zonal',
    name: ['জোনাল ইনচার্জ — ঢাকা', 'Zonal In-charge — Dhaka'],
    owner: ['ফারহানা ইয়াসমিন', 'Farhana Yasmin'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['ঢাকা', 'Dhaka'],
    msisdn: '8801711889900',
    address: ['টেলিটক ভবন, ঢাকা', 'Teletalk Bhaban, Dhaka'],
    enlistedOn: '2014-09-01',
    stats: { simStock: 128400, pendingApprovals: 24 },
  },
  {
    posCode: '30050001',
    role: 'invoiceOfficer',
    name: ['জোনাল ইনভয়েস অফিসার', 'Zonal Invoice Officer'],
    owner: ['নাজমুল হাসান', 'Nazmul Hasan'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['ঢাকা', 'Dhaka'],
    msisdn: '8801711334455',
    address: ['টেলিটক ভবন, ঢাকা', 'Teletalk Bhaban, Dhaka'],
    enlistedOn: '2017-04-12',
    stats: { pendingApprovals: 9 },
  },
  {
    posCode: '30060001',
    role: 'inventoryOfficer',
    name: ['ইনভেন্টরি অফিসার — ঢাকা', 'Inventory Officer — Dhaka'],
    owner: ['সাব্বির রহমান', 'Sabbir Rahman'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['ঢাকা', 'Dhaka'],
    msisdn: '8801711667788',
    address: ['কেন্দ্রীয় গুদাম, ঢাকা', 'Central Warehouse, Dhaka'],
    enlistedOn: '2016-11-30',
    stats: { simStock: 486200, pendingApprovals: 15 },
  },
  {
    posCode: '30070001',
    role: 'revenueAssurance',
    name: ['রেভিনিউ এসুরেন্স — এফএন্ডএ', 'Revenue Assurance — F&A'],
    owner: ['মাহবুবা আক্তার', 'Mahbuba Akhter'],
    zone: ['প্রধান কার্যালয়', 'Head Office'],
    territory: ['সর্বজনীন', 'All zones'],
    msisdn: '8801711223344',
    address: ['অর্থ ও হিসাব বিভাগ, ঢাকা', 'Finance & Accounts, Dhaka'],
    enlistedOn: '2013-02-18',
    stats: { pendingApprovals: 31 },
  },
  {
    posCode: '30080001',
    role: 'branchHead',
    name: ['শাখা প্রধান — বিক্রয় ও বিতরণ-১', 'Branch Head — S&D-1'],
    owner: ['কামরুল ইসলাম', 'Kamrul Islam'],
    zone: ['ঢাকা জোন', 'Dhaka Zone'],
    territory: ['বিক্রয় ও বিতরণ-১', 'S&D-1'],
    msisdn: '8801711445566',
    address: ['টেলিটক ভবন, ঢাকা', 'Teletalk Bhaban, Dhaka'],
    enlistedOn: '2011-07-05',
    stats: { pendingApprovals: 6 },
  },
  {
    posCode: '30090001',
    role: 'csim',
    name: ['সিএসআইএম — কেন্দ্রীয় মজুত', 'CSIM — Central Stock'],
    owner: ['রেজাউল করিম', 'Rezaul Karim'],
    zone: ['প্রধান কার্যালয়', 'Head Office'],
    territory: ['সর্বজনীন', 'All zones'],
    msisdn: '8801711778899',
    address: ['কেন্দ্রীয় ইনভেন্টরি, ঢাকা', 'Central Inventory, Dhaka'],
    enlistedOn: '2012-10-14',
    stats: { simStock: 2140000, pendingApprovals: 18 },
  },
  {
    posCode: '30100001',
    role: 'admin',
    name: ['সিস্টেম অ্যাডমিন', 'System Administrator'],
    owner: ['আইটি ও বিলিং', 'IT & Billing'],
    zone: ['প্রধান কার্যালয়', 'Head Office'],
    territory: ['সর্বজনীন', 'All zones'],
    msisdn: '8801711000001',
    address: ['আইটি ও বিলিং বিভাগ, ঢাকা', 'IT & Billing, Dhaka'],
    enlistedOn: '2010-01-01',
    stats: { simStock: 2140000, pendingApprovals: 48 },
  },
]

export const DEMO_ACCOUNTS: DemoAccount[] = DRAFTS.map((d) => ({
  posCode: d.posCode,
  role: d.role,
  session: {
    posCode: d.posCode,
    name: { bn: d.name[0], en: d.name[1] },
    ownerName: { bn: d.owner[0], en: d.owner[1] },
    role: d.role,
    zone: { bn: d.zone[0], en: d.zone[1] },
    territory: { bn: d.territory[0], en: d.territory[1] },
    msisdn: d.msisdn,
    outletAddress: { bn: d.address[0], en: d.address[1] },
    enlistedOn: d.enlistedOn,
    tier: d.tier,
    stats: d.stats,
    passwordUpdatedOn: '2026-02-11',
  },
}))

export function findAccount(posCode: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.posCode === posCode)
}

export function sessionFor(account: DemoAccount, deviceTrusted: boolean): Session {
  return {
    ...account.session,
    capabilities: CAPABILITIES_BY_ROLE[account.role],
    deviceTrusted,
  }
}
