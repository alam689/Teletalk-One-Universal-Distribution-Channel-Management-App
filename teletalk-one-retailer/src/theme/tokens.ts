/**
 * Teletalk One — design tokens, ported from the web portal's `tokens.css`.
 *
 * The values are the same values. A retailer who uses the portal on a counter
 * PC and this app on a phone is looking at one product, and two palettes that
 * drifted apart would be the first thing to say otherwise.
 *
 * What does not port is the mechanism. There is no cascade here, so a token is
 * a property on an object and a component reads it through `useTheme()`.
 * Nothing may write a raw hex value — the contrast work behind these numbers
 * is not re-derivable from looking at them.
 *
 *   brandBright  vivid Teletalk green. 3.0:1 on white → NON-TEXT ONLY
 *   brand        deepened emerald, 5.4:1 on white → anything text-bearing
 *   brandPanel   panel ground; stays dark in BOTH themes because it always
 *                carries white text, while `brand` flips light
 */

export interface Palette {
  paper: string
  surface: string
  surface2: string
  surface3: string
  ink: string
  inkSoft: string
  muted: string
  rule: string
  ruleSoft: string
  /** The edge of a *control*, not a divider. 3:1 minimum — WCAG 1.4.11. */
  ruleControl: string

  brand: string
  brandBright: string
  brandDeep: string
  brandHover: string
  brandWash: string
  brandPanel: string
  onBrand: string
  onBrandSoft: string
  accentYellow: string

  danger: string
  dangerWash: string
  warn: string
  warnWash: string
  ok: string
  okWash: string
  focus: string
}

/**
 * Category wells and inks. Sixty-two identical green tiles are unscannable —
 * a retailer hunting for "commission" aims at a colour first and reads second.
 * Inks clear 4.5:1 on their own well in both themes.
 */
export interface CategoryColour {
  well: string
  ink: string
}

export type CategoryName =
  | 'sim'
  | 'mnp'
  | 'recharge'
  | 'stock'
  | 'finance'
  | 'report'
  | 'campaign'
  | 'service'

export const light: Palette = {
  paper: '#f1f8f4',
  surface: '#ffffff',
  surface2: '#eef6f1',
  surface3: '#e6f2eb',
  ink: '#0f1f18',
  inkSoft: '#3b534a',
  muted: '#5f7269',
  rule: '#e2eee8',
  ruleSoft: '#edf5f1',
  ruleControl: '#7d968b',

  brand: '#0b7a4f',
  brandBright: '#00b84d',
  brandDeep: '#05442d',
  brandHover: '#096540',
  brandWash: '#e4f4ea',
  brandPanel: '#0b7a4f',
  onBrand: '#ffffff',
  onBrandSoft: 'rgba(255, 255, 255, 0.93)',
  accentYellow: '#ffd34d',

  danger: '#9b3521',
  dangerWash: '#fbe6e0',
  warn: '#8f5600',
  warnWash: '#fbeed6',
  ok: '#0b7a4f',
  okWash: '#e0f2e7',
  focus: '#0b7a4f',
}

export const dark: Palette = {
  paper: '#071310',
  surface: '#0e1d17',
  surface2: '#142720',
  surface3: '#1a3128',
  ink: '#e6efe9',
  inkSoft: '#c3d2cb',
  muted: '#8ba299',
  rule: '#21362d',
  ruleSoft: '#182a22',
  ruleControl: '#5c7f71',

  brand: '#3fd183',
  brandBright: '#4fe096',
  brandDeep: '#04241a',
  brandHover: '#56dd94',
  brandWash: '#133527',
  brandPanel: '#075437',
  onBrand: '#ffffff',
  onBrandSoft: 'rgba(255, 255, 255, 0.93)',
  accentYellow: '#ffd34d',

  danger: '#f0907a',
  dangerWash: '#35190f',
  warn: '#e0aa5e',
  warnWash: '#33260f',
  ok: '#3fd183',
  okWash: '#10301f',
  focus: '#4fe096',
}

export const categories: Record<'light' | 'dark', Record<CategoryName, CategoryColour>> = {
  light: {
    sim: { well: '#e2f3e9', ink: '#0b6b46' },
    mnp: { well: '#e2edfa', ink: '#1a5487' },
    recharge: { well: '#fbeeda', ink: '#855100' },
    stock: { well: '#ece8f8', ink: '#4f3f97' },
    finance: { well: '#f4efd8', ink: '#6f5a00' },
    report: { well: '#e6e8f7', ink: '#3a3f96' },
    campaign: { well: '#fae4ec', ink: '#932650' },
    service: { well: '#ddf0f7', ink: '#0b5d77' },
  },
  dark: {
    sim: { well: '#12332a', ink: '#4ecf94' },
    mnp: { well: '#12283c', ink: '#6fb4ec' },
    recharge: { well: '#33260f', ink: '#e2ab5c' },
    stock: { well: '#241f3d', ink: '#a99aec' },
    finance: { well: '#2e2811', ink: '#d6bd52' },
    report: { well: '#1e2040', ink: '#9aa2ee' },
    campaign: { well: '#351623', ink: '#ec8fb0' },
    service: { well: '#0f2b36', ink: '#63bcd9' },
  },
}

/* ---------------------------- non-colour scale --------------------------- */

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const

export const radius = {
  sm: 8,
  base: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const

/**
 * Type scale in points, converted from the web's rem values at a 16px root.
 * React Native does not scale these with the OS font setting by default; the
 * `Text` primitive in `components/` opts back in, because a retailer who has
 * enlarged their system font meant it.
 */
export const font = {
  xs: 12.5,
  sm: 14,
  base: 16,
  lg: 18.5,
  xl: 23,
  xxl: 31,
} as const

/** Bangla needs more leading — matras sit above and below the baseline. */
export const leading = {
  bn: { body: 1.7, tight: 1.35 },
  en: { body: 1.55, tight: 1.25 },
} as const

/**
 * 44pt, the same floor the web app uses. It is Apple's HIG minimum and it is
 * also just true: this app is used one-handed, outdoors, by someone holding a
 * customer's NID in the other hand.
 */
export const TAP_MIN = 44

/**
 * Identifiers are monospaced so a digit can be dictated over the phone without
 * ambiguity. The families differ per platform; the intent does not.
 */
export const monoFamily = { ios: 'Menlo', android: 'monospace', default: 'monospace' } as const
