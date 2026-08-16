/**
 * CI gate: the client and the OpenAPI document cannot drift.
 *
 * Two failures it catches, both of which have shipped in real projects:
 *
 *  1. Someone edits `src/lib/apiRoutes.ts` by hand to add an endpoint, and the
 *     contract handed to the integration team is silently missing it.
 *  2. Someone adds a path to the contract and nothing in the client ever calls
 *     it, so a "supported" endpoint has never been exercised.
 *
 * The second is reported as a warning, not a failure — a contract may legitimately
 * describe endpoints a later phase will call.
 *
 * Run: npm run contract:check
 */
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, statSync } from 'node:fs'
import { OUTPUT_PATH, readSpec, render } from './generate-routes.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const spec = readSpec()
const expected = render(spec)
const actual = readFileSync(OUTPUT_PATH, 'utf8')

let failures = 0

if (expected.replace(/\r\n/g, '\n') !== actual.replace(/\r\n/g, '\n')) {
  console.error(
    '\nsrc/lib/apiRoutes.ts has drifted from openapi/teletalk-one.json.' +
      '\nRun: npm run contract:generate\n',
  )
  failures += 1
}

/* --------------------- is every route actually called? --------------------- */

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const sources = walk(join(root, 'src'))
  .filter((f) => ['.ts', '.tsx'].includes(extname(f)))
  .filter((f) => f !== OUTPUT_PATH)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const operationIds = Object.values(spec.paths).flatMap((item) =>
  Object.values(item).map((op) => op.operationId),
)

const uncalled = operationIds.filter((id) => !sources.includes(`API_ROUTES.${id}`))

if (uncalled.length) {
  console.warn(`\nContract operations no client code calls (${uncalled.length}):`)
  for (const id of uncalled) console.warn(`  - ${id}`)
}

/* ------------------------- no hand-written paths -------------------------- */

// A literal path passed to `request(...)` bypasses the table entirely, which is
// exactly the convention this gate exists to replace.
const literalCalls = walk(join(root, 'src'))
  .filter((f) => ['.ts', '.tsx'].includes(extname(f)))
  .flatMap((file) => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(/\brequest<[^>]*>\(\s*['"](\/[^'"]*)['"]/g)].map((m) => ({
      file: relative(root, file).replace(/\\/g, '/'),
      path: m[1],
    }))
  })

if (literalCalls.length) {
  console.error(`\nHard-coded API paths (${literalCalls.length}) — use API_ROUTES instead:`)
  for (const c of literalCalls) console.error(`  - ${c.file}: ${c.path}`)
  failures += 1
}

if (failures) {
  console.error(`\ncontract check failed: ${failures} problem(s).\n`)
  process.exit(1)
}

console.log(
  `contract check passed — ${operationIds.length} operations, client and spec in sync.`,
)
