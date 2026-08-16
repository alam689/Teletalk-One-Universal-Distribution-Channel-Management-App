/**
 * The channel product catalogue, as the requisition screen needs it.
 *
 * In the portal this list lives in the lifting mock, because the lifting chain
 * is where a product's pack size and unit price actually matter. This app has
 * no lifting chain — a retailer does not raise demand on the dealer's behalf —
 * so the list is lifted out on its own rather than dragging eight desks of
 * state machine along with it.
 *
 * It stays byte-identical to the portal's on purpose: a requisition raised
 * here is approved there, and two catalogues that drift would put a product
 * code on the screen that the approver has never heard of.
 */

export interface ChannelProduct {
  code: string
  name: { bn: string; en: string }
  unitPrice: number
  /** Sold in packs of this size; demand is a multiple of it. */
  packSize: number
}

export const CHANNEL_PRODUCTS: ChannelProduct[] = [
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
