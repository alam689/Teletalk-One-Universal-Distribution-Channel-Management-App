/**
 * CI gate: every colour pair the app actually renders clears WCAG AA, in both
 * themes.
 *
 * This was a manual measurement repeated by hand at the end of three phases,
 * which is exactly the kind of check that gets skipped the one time it would
 * have caught something. The pairs below are declared rather than discovered —
 * a stylesheet crawler would have to understand which colour lands on which
 * background, and guessing wrong makes the gate useless in both directions.
 *
 * Adding a component means adding its pair here. That is the point.
 *
 * Run: npm run contrast:check
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../src/styles/tokens.css'), 'utf8')

/** Text below 18.66px bold / 24px regular. Everything here is body-sized. */
const AA_TEXT = 4.5
/** Borders, icons, focus rings — WCAG 1.4.11 non-text contrast. */
const AA_NON_TEXT = 3

/**
 * `foreground on background`, plus what it is for. Every one of these is a
 * pair some component renders today.
 */
const PAIRS = [
  ['--ink', '--paper', AA_TEXT, 'body text on the page'],
  ['--ink', '--surface', AA_TEXT, 'body text on a card'],
  ['--ink-soft', '--surface', AA_TEXT, 'secondary text'],
  ['--muted', '--surface', AA_TEXT, 'labels, meta lines, help text'],
  ['--muted', '--surface-2', AA_TEXT, 'meta on a sunken row'],
  ['--brand', '--surface', AA_TEXT, 'links and the resumed notice'],
  ['--brand', '--brand-wash', AA_TEXT, 'brand pill, metric--strong, outbox banner'],
  ['--brand-ink', '--brand', AA_TEXT, 'primary button label, pressed chip'],
  ['--on-brand', '--brand-panel', AA_TEXT, 'sign-in panel text'],
  ['--on-brand-soft', '--brand-panel', AA_TEXT, 'dimmed sign-in panel text'],
  ['--ok', '--ok-wash', AA_TEXT, 'settled pill, success alert'],
  ['--warn', '--warn-wash', AA_TEXT, 'queued pill, warning alert, offline banner'],
  ['--danger', '--danger-wash', AA_TEXT, 'failed pill, danger alert, field error'],
  ['--danger', '--surface', AA_TEXT, 'inline field error text'],
  /**
   * `--rule` and `--brand-bright` on a surface are deliberately absent.
   * Neither is ever the sole carrier of meaning: `--rule` draws dividers
   * between rows that are already separated by spacing, and `--brand-bright`
   * fills progress bars and chart columns whose figures are printed beside
   * them. Control boundaries and focus use the two tokens below, which are
   * held to 3:1.
   */
  ['--rule-control', '--surface', AA_NON_TEXT, 'input, select and chip boundaries'],
  ['--focus', '--surface', AA_NON_TEXT, 'focus ring and focused control border'],
]

/* ------------------------------ plumbing ------------------------------ */

/** tokens.css defines light on `:root` and dark under a media/attr block. */
function readTheme(source, blockMatcher) {
  const block = blockMatcher ? source.match(blockMatcher)?.[0] ?? '' : source
  const values = {}
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    values[name] = value.trim()
  }
  return values
}

const light = readTheme(css, /:root\s*\{[\s\S]*?\n\}/)
const dark = { ...light, ...readTheme(css, /\[data-theme='dark'\]\s*\{[\s\S]*?\n\}/) }

function toRgb(value, theme, depth = 0) {
  if (depth > 5) return null
  const raw = value.trim()
  const varRef = raw.match(/^var\((--[a-z0-9-]+)\)$/)
  if (varRef) return toRgb(theme[varRef[1]] ?? '', theme, depth + 1)

  const hex = raw.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const short = raw.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    const [r, g, b] = short[1].split('')
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)]
  }
  const rgb = raw.match(/^rgba?\(([^)]+)\)/)
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    // Keep the alpha: the caller knows what is behind it and can composite.
    if (parts.length > 3 && parts[3] < 1) return { rgb: parts.slice(0, 3), alpha: parts[3] }
    return parts.slice(0, 3)
  }
  return null
}

/** Source-over: what a translucent colour actually renders as. */
function composite({ rgb, alpha }, backdrop) {
  return rgb.map((c, i) => Math.round(c * alpha + backdrop[i] * (1 - alpha)))
}

const channel = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/* -------------------------------- check -------------------------------- */

const failures = []
const rows = []

for (const [themeName, theme] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [fg, bg, threshold, what] of PAIRS) {
    const a = toRgb(theme[fg] ?? '', theme)
    const b = toRgb(theme[bg] ?? '', theme)

    if (!a || !b) {
      failures.push(`${themeName}: ${fg} on ${bg} — token missing or unparseable`)
      continue
    }
    // A translucent background cannot be resolved without knowing what is
    // behind *it*, so that stays a failure. A translucent foreground over an
    // opaque background is just arithmetic.
    if (!Array.isArray(b)) {
      failures.push(`${themeName}: ${bg} is translucent and cannot be a measured background`)
      continue
    }
    const front = Array.isArray(a) ? a : composite(a, b)

    const value = ratio(front, b)
    rows.push({ themeName, fg, bg, value, threshold, what })
    if (value < threshold) {
      failures.push(
        `${themeName}: ${fg} on ${bg} is ${value.toFixed(2)}:1, needs ${threshold}:1 — ${what}`,
      )
    }
  }
}

if (failures.length) {
  console.error(`\nContrast failures (${failures.length}):`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error('')
  process.exit(1)
}

const worst = rows.reduce((a, b) => (a.value < b.value ? a : b))
console.log(
  `contrast check passed — ${rows.length} pairs across both themes, ` +
    `lowest ${worst.value.toFixed(2)}:1 (${worst.fg} on ${worst.bg}, ${worst.themeName})`,
)
