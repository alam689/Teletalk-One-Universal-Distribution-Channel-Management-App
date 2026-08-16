/**
 * Generates `src/lib/apiRoutes.ts` from `openapi/teletalk-one.json`.
 *
 * This is the smallest useful piece of client generation, and deliberately the
 * only one for now: **paths and methods**. Generating request and response
 * types from a contract nobody outside this repo has confirmed would produce
 * confident-looking types for shapes BVS may never send — the drift guard has
 * value today, the types would not. When IT&B confirm the document, widen this
 * script (or swap it for openapi-typescript) and delete this paragraph.
 *
 * Run: npm run contract:generate
 * CI:  npm run contract:check  (fails if the checked-in file has drifted)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export const SPEC_PATH = resolve(here, '../openapi/teletalk-one.json')
export const OUTPUT_PATH = resolve(here, '../src/lib/apiRoutes.ts')

export function readSpec() {
  return JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
}

export function render(spec) {
  const operations = []
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!op.operationId) {
        throw new Error(`${method.toUpperCase()} ${path} has no operationId`)
      }
      operations.push({
        id: op.operationId,
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? '',
        idempotent: (op.parameters ?? []).some(
          (p) => p.$ref === '#/components/parameters/IdempotencyKey',
        ),
      })
    }
  }
  operations.sort((a, b) => a.id.localeCompare(b.id))

  const entries = operations
    .map(
      (o) =>
        `  /** ${o.summary}${o.idempotent ? '. Requires an Idempotency-Key' : ''} */\n` +
        `  ${o.id}: { method: '${o.method}', path: '${o.path}' },`,
    )
    .join('\n')

  return `/**
 * GENERATED FILE — do not edit.
 *
 * Source: openapi/teletalk-one.json (${spec.info.version})
 * Regenerate: npm run contract:generate
 *
 * Every request the client makes goes through a route in this table. That is
 * what makes the contract a file rather than a convention: a path that is not
 * in the OpenAPI document cannot be called, and CI fails if this file and the
 * document disagree.
 */

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
}

export const API_ROUTES = {
${entries}
} as const satisfies Record<string, ApiRoute>

export type ApiOperationId = keyof typeof API_ROUTES

/** Operations that MUST carry an Idempotency-Key. The outbox owns the key. */
export const IDEMPOTENT_OPERATIONS: ApiOperationId[] = [
${operations
  .filter((o) => o.idempotent)
  .map((o) => `  '${o.id}',`)
  .join('\n')}
]
`
}

// Only write when run directly; `contract:check` imports `render` instead.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { writeFileSync } = await import('node:fs')
  const spec = readSpec()
  writeFileSync(OUTPUT_PATH, render(spec), 'utf8')
  console.log(`generated src/lib/apiRoutes.ts — ${Object.keys(spec.paths).length} paths`)
}
