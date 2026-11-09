/**
 * Assembles the GitHub Pages site from both app builds.
 *
 * A repository gets exactly one Pages site, and every deploy replaces all of
 * it — so the two apps have to be published together or each deploy would wipe
 * the other. Layout:
 *
 *   /<repo>/          the retailer app (teletalk-one-retailer/dist, unchanged)
 *   /<repo>/portal/   the management portal (teletalk-one-web/dist)
 *
 * Pages serves one 404.html for the whole site, and both apps are single pages
 * that rely on it for deep links. The retailer's 404.html (a copy of its index)
 * stays, with one script put in front: a missed path under /portal/ is bounced
 * to /portal/?p=<rest>, and the portal's index.html puts the path back before
 * its router starts.
 *
 * Run from the repo root: node scripts/compose-pages.mjs <repo-name> [out-dir]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const repo = process.argv[2]
if (!repo) {
  console.error('compose: pass the repository name.')
  process.exit(1)
}

const retailer = 'teletalk-one-retailer/dist'
const portal = 'teletalk-one-web/dist'
for (const dir of [retailer, portal]) {
  if (!existsSync(`${dir}/index.html`)) {
    console.error(`compose: ${dir}/index.html is missing — build it first.`)
    process.exit(1)
  }
}

const site = process.argv[3] || '_site'
rmSync(site, { recursive: true, force: true })
mkdirSync(site)
cpSync(retailer, site, { recursive: true })
cpSync(portal, `${site}/portal`, { recursive: true })
// The portal ships sourcemaps for local debugging; a public demo doesn't need them.
for (const f of readdirSync(`${site}/portal/assets`)) {
  if (f.endsWith('.map')) rmSync(`${site}/portal/assets/${f}`)
}
writeFileSync(`${site}/.nojekyll`, '')

const prefix = `/${repo}/portal`
const bounce = `<script>
      ;(function (l) {
        var base = ${JSON.stringify(prefix)}
        if (l.pathname.indexOf(base + '/') !== 0) return
        var rest = l.pathname.slice(base.length)
        l.replace(base + '/?p=' + encodeURIComponent(rest) + l.search.replace(/^\\?/, '&') + l.hash)
      })(window.location)
    </script>`
const notFound = `${site}/404.html`
const html = existsSync(notFound) ? readFileSync(notFound, 'utf8') : readFileSync(`${site}/index.html`, 'utf8')
writeFileSync(notFound, html.replace('<head>', `<head>\n    ${bounce}`))

console.log(`compose: ${site} ready — retailer at /${repo}/, portal at ${prefix}/`)
