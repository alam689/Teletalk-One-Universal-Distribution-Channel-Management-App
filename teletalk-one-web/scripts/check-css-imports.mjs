/**
 * CI gate: every stylesheet under src/ must be imported by some module.
 *
 * Exists because deleting the last component that imported `app.css` silently
 * dropped the whole signed-out shell's styling — typecheck, lint, tests and the
 * build all passed, and the sign-in screen shipped unstyled. A stylesheet with
 * no importer is dead weight at best and a missing layout at worst.
 *
 * Run: npm run css:check
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(srcDir)
const stylesheets = files.filter((f) => extname(f) === '.css')
const modules = files.filter((f) => ['.ts', '.tsx'].includes(extname(f)))

// Collect every `import '...css'` specifier and resolve it against its importer.
const imported = new Set()
for (const mod of modules) {
  const source = readFileSync(mod, 'utf8')
  for (const match of source.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)) {
    const spec = match[1]
    // Bare specifiers (e.g. @fontsource/...) are package assets, not ours.
    if (!spec.startsWith('.')) continue
    imported.add(resolve(dirname(mod), spec))
  }
}

const orphans = stylesheets
  .filter((css) => !imported.has(css))
  .map((css) => relative(root, css).replace(/\\/g, '/'))

if (orphans.length) {
  console.error(`\nStylesheets with no importer (${orphans.length}):`)
  for (const o of orphans) console.error(`  - ${o}`)
  console.error('\nImport it from the component that owns it, or delete it.\n')
  process.exit(1)
}

console.log(`css check passed — ${stylesheets.length} stylesheets, all imported.`)
