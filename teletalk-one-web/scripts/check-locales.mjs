/**
 * CI gate: bn.json is the source of truth. Fails the build when en.json is
 * missing a key, carries an extra one, or has left a value identical to the
 * Bangla source (an untranslated paste).
 *
 * Run: npm run i18n:check
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const load = (f) => JSON.parse(readFileSync(resolve(here, '../src/i18n/locales', f), 'utf8'))

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' ? flatten(v, key) : [[key, v]]
  })

/**
 * Keys that are deliberately identical in both locales. Brand assets are not
 * copy — Teletalk's tagline "আমাদের ফোন" appears in Bangla on the English
 * lockup too, exactly as it does on the corporate brand plate. Keep this list
 * short and justify every entry; it is an exemption from the untranslated
 * check, not a place to park unfinished work.
 */
const INTENTIONALLY_UNTRANSLATED = new Set([
  'app.tagline', // brand lockup, Bangla in both locales
])

const bn = new Map(flatten(load('bn.json')))
const en = new Map(flatten(load('en.json')))

const missing = [...bn.keys()].filter((k) => !en.has(k))
const extra = [...en.keys()].filter((k) => !bn.has(k))
const untranslated = [...bn.entries()].filter(
  ([k, v]) =>
    en.has(k) &&
    en.get(k) === v &&
    /[ঀ-৿]/.test(String(v)) &&
    !INTENTIONALLY_UNTRANSLATED.has(k),
)

// A stale exemption is its own bug: it would silence a real miss later.
const staleExemptions = [...INTENTIONALLY_UNTRANSLATED].filter(
  (k) => !bn.has(k) || en.get(k) !== bn.get(k),
)

const report = (title, rows) => {
  if (!rows.length) return 0
  console.error(`\n${title} (${rows.length})`)
  for (const r of rows) console.error(`  - ${Array.isArray(r) ? r[0] : r}`)
  return rows.length
}

const failures =
  report('Missing in en.json', missing) +
  report('Present in en.json but not in bn.json', extra) +
  report('Untranslated — still Bangla in en.json', untranslated) +
  report('Stale exemption in INTENTIONALLY_UNTRANSLATED', staleExemptions)

if (failures) {
  console.error(`\ni18n check failed: ${failures} problem(s).\n`)
  process.exit(1)
}

console.log(`i18n check passed — ${bn.size} keys, bn and en in sync.`)
