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

const bn = new Map(flatten(load('bn.json')))
const en = new Map(flatten(load('en.json')))

const missing = [...bn.keys()].filter((k) => !en.has(k))
const extra = [...en.keys()].filter((k) => !bn.has(k))
const untranslated = [...bn.entries()].filter(
  ([k, v]) => en.has(k) && en.get(k) === v && /[ঀ-৿]/.test(String(v)),
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
  report('Untranslated — still Bangla in en.json', untranslated)

if (failures) {
  console.error(`\ni18n check failed: ${failures} problem(s).\n`)
  process.exit(1)
}

console.log(`i18n check passed — ${bn.size} keys, bn and en in sync.`)
