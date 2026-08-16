# Teletalk One — management portal

React web frontend for the Universal Distribution Channel Management App.
Bangla-first, bilingual, capability-driven, responsive from 320px to desktop.

```bash
npm install
cp .env.example .env
npm run dev
```

```bash
npm run verify
```

`verify` runs typecheck → i18n parity → css imports → API contract → colour
contrast → lint → tests → production build. Wire it as the CI gate; nothing
should merge that doesn't pass it.

## Demo accounts (mock API only)

Password `Tele@1234`, OTP `123456` for all. The sign-in screen shows a role
picker in development. POS `20060795` returns the inactive-account path.

| POS | Role | Sees |
|---|---|---|
| `20060794` | Retailer | SIM, MNP, recharge, own stock, commission, campaigns |
| `30010001` | Sales representative | Route, allocation, retailer stock — no activation |
| `30020001` | Dealer | Demand, deposit slip, challan, SRs, retailers, wallet |
| `30030001` | Field officer | Demand recommendation, deposit verify, onboarding, POSM |
| `30040001` | Zonal in-charge | Demand approval, zonal inventory, territory, geo-fence |
| `30050001` | Zonal invoice officer | ERP invoice, deposit verify, challan |
| `30060001` | Inventory officer | Central & zonal inventory, challan, reconciliation |
| `30070001` | F&A revenue assurance | Revenue assurance gate, settlement, outstanding |
| `30080001` | Branch head | Oversight, approvals, reports — no counter operations |
| `30090001` | CSIM | Central stock, requisition approval, choice numbers |
| `30100001` | System administrator | Everything (62 services, 0 locked) |

The capability sets live in `features/auth/roles.ts` — that file is the org
model in code. `roles.test.ts` pins the separation of duties from deck slides 6
and 7: no role may hold two adjacent steps of the lifting chain, and the person
who raises the deposit slip is never the one who verifies it.

## Configuration

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | API gateway base URL. **Empty means the in-repo mock runs** — a production build without it logs an error at startup. |
| `VITE_API_TIMEOUT_MS` | Request timeout. Do not drop below ~15s; activations fail on 2G. |
| `VITE_IDLE_TIMEOUT_MIN` | Inactivity before the session ends. Retailer terminals are shared counters — keep it short. |

## Routes

| Path | Screen |
|---|---|
| `/login` | Three-step sign-in: POS code → password → OTP, with device binding |
| `/` | Home — balance, commission, stock, quick actions, catalogue preview |
| `/services` | Full 62-service catalogue, grouped, searchable (`?q=` is in the URL) |
| `/services/simActivate` | **Activation** — SIM → NID → e-SAF → biometric → review → done, with the first recharge inline |
| `/services/simReplace` | **Replacement** — same engine, no e-SAF |
| `/services/mnpPortIn` | **MNP port in** — same engine, donor operator, non-Teletalk number |
| `/services/ownership` | **Ownership change** — same engine, full e-SAF for the incoming owner |
| `/services/planMigration` | **Plan migration** — same engine, three steps |
| `/services/mnpPortOut` · `mnpStatus` | Port out on the same engine; MNP status is where a customer's "has it gone through?" gets answered |
| `/services/recharge` · `flexiload` · `powerload` · `tbps` · `productSell` · `scratchCard` | Over-the-counter sales, on the same engine and the same queue |
| `/services/transactions` | Ledger — the server's history with the client's unsent queue merged in |
| `/services/simStock` · `productStock` | Stock by batch; SIM batches carry a serial range, product batches do not |
| `/services/commission` · `commissionStatement` | Commission, and the statement behind it with settlement references |
| `/services/outstanding` · `target` | What the outlet owes; targets and achievement for the month |
| `/services/campaigns` · `myCampaign` · `offers` | Campaigns, the ones this outlet is in, and offers to quote |
| `/services/salesReport` | Sales totals and a per-day series |
| `/services/customerSearch` | Subscriber lookup by full MSISDN or NID, NID masked |
| `/services/notifications` | Notification centre; the top-bar bell reads from it |
| `/services/support` | Who to call, and the identifiers they will ask for |
| `/services/demandRequest` … `deliveryChallan` | **The lifting chain** — eight desks, one request object, six roles |
| `/services/centralInventory` · `zonalInventory` | Warehouse stock, on hand beside allocated |
| `/services/srRoute` · `srAllocation` | The SR's route today, and handing stock to an SR |
| `/services/choiceNumber` | Search the number pool and hold a number while the customer decides |
| `/services/requisition` · `requisitionApprove` | The short approval chain for stock down the channel |
| `/services/complaintCreate` · `complaintTrack` | Raise a ticket; track it against its SLA clock |
| `/services/wallet` · `paymentCollect` · `settlement` · `subsidy` | Balance and ledger, cash collection, settlement records, subsidy |
| `/services/stockReturn` · `stockTransfer` · `stockReconcile` | Reverse and lateral movements, and a physical count with variance |
| `/services/customer360` · `performance` | The full subscriber view, and the outlet scorecard |
| `/services/retailerManage` · `retailerOnboard` · `retailerProvision` | Outlets, enlisting one, and the BVS/DMS access that lets it trade |
| `/services/userManage` · `territory` | Channel users and the zone → territory → route hierarchy |
| `/services/fieldVisit` · `posm` · `geofence` · `deviceMonitor` | Visits with a location fix, POSM audits, geo-fences, device health |
| `/services/:moduleId` | 404 fallback — every tile in the catalogue is now a real screen |
| `/profile` | Outlet, proprietor, zone, territory, tier, security, permitted services |
| `/profile/password` | Change password with live-ticking policy rules |
| `*` | 404 |

## Production concerns and where they live

| Concern | Where |
|---|---|
| **Session lifecycle** | `AuthProvider` — restore on boot from an httpOnly refresh cookie, idle timeout, cross-tab sign-out broadcast, single 401 handler that ends the session once |
| **Tokens** | In memory only (`lib/http.ts`). Never localStorage — XSS there is token exfiltration |
| **Network** | `lib/http.ts` — timeout, caller-abort composition, bounded retry with jittered backoff on idempotent GETs only, `Retry-After`, normalised error codes |
| **Access control** | Capability set from the server. Unauthorized services are **absent** from the UI — never rendered disabled — and a group with nothing permitted drops out entirely. That is presentation; the real guard is `ModulePage` re-checking on deep link, because the URL is guessable. `ServicesPage.test.tsx` asserts both halves per role |
| **Crash containment** | `ErrorBoundary` with static bilingual copy — it may be rendering *because* i18n or CSS failed |
| **Offline** | `OfflineBanner` plus an `offline` short-circuit before any request is attempted |
| **Routing a11y** | `RouteAnnouncer` — live-region announcement, focus moved to `#main`, document title per route. Skip link in the shell |
| **Diagnostics** | `lib/logger.ts`. `debug`/`warn` compile out of production. `logger.error` is the only route to a crash reporter, attached with `setCrashReporter`, and every report is **scrubbed by shape** — MSISDN, NID and ICCID runs are replaced before anything leaves the device |
| **Sessions** | `AuthProvider` refreshes the access token at 80% of its life rather than waiting for a 401. A retailer halfway through an e-SAF must not be bounced to sign-in because a timer expired between two keystrokes |
| **Responsive** | Mobile-first, but not mobile-only: from 900px the wizard splits into a rail and a main column, forms become two columns, and a queue sits beside the record it opened. See the note at the top of `wizard.css` |
| **Counter transactions** | `features/wizard/` is the engine — resumable, step-validated, abandonable. `features/activation/flowSpec.ts` is the five SIM flows *as data*; `flows.test.tsx` fails the build if any of them needs an engine change |
| **Separation of duties** | `features/lifting/liftingStates.ts` — the chain's stages, who owns each, and who may act. No capability owns two adjacent steps, and the dealer who raised a request may act only on the dealer-side stages. `liftingStates.test.ts` fails the build if an edit breaks either |
| **Drafts** | `features/wizard/draft.ts` — sessionStorage, not localStorage. A draft carries the customer's NID and the counter is a shared terminal; tab scope survives the reload without surviving the next walk-in. Redacted fields (biometric) never reach storage at all |
| **Offline mutations** | `lib/outbox.ts` — one idempotency key per mutation, generated at enqueue and reused on every retry. Only transient failures retry; a rejected NID fails terminally with a remedy. Sequential, so nothing overtakes a mutation that has not landed |
| **Reads** | `lib/useResource.ts` — abort on unmount and on key change, an `error.*` key rather than a boolean, and a reload. `components/data.tsx` makes loading, empty, broken and fine all unavoidable states |
| **API contract** | `openapi/teletalk-one.json` generates `lib/apiRoutes.ts`. `npm run contract:check` fails on drift and on any hard-coded path, so the contract is a file rather than a convention |
| **Query strings** | Only non-identifying selectors. An NID or MSISDN goes in a POST body — a query string is written to every proxy log between here and CBS |
| **Location** | `lib/geo.ts` — a fix, its accuracy, and a great-circle distance. **There is no map**: a mapping library is 150 kB plus third-party tile requests, and this app has a no-external-request policy for a 2G counter phone. A location is a coordinate pair and a distance, which is what a field officer can read and a server can check |
| **Queued outcomes** | `features/outbox/OutcomePanel.tsx` — the queued / done / refused states in one component, so the middle one cannot be dropped at a call site |
| **Bundle** | Route-level lazy loading plus a vendor split, so an app release doesn't invalidate the React and i18n chunks in every retailer's cache. The whole transaction surface is its own chunk — a role that cannot activate never downloads it |

## Responsive

Two independent breakpoints, deliberately different — collapsing them into one
is what made the top bar overflow at 753px:

- **720px — navigation mode.** Below it a fixed bottom bar replaces the top nav, with `env(safe-area-inset-bottom)` padding for notched devices.
- **900px — chrome density.** Below it the language and theme symbols and the outlet name fold into the account menu.

Verified for horizontal overflow across 320 / 360 / 375 / 414 / 480 / 540 / 600 /
660 / 700 / 720 / 721 / 760 / 800 / 860 / 900 / 901 / 960 / 1024 / 1200 / 1440.
Every touch target clears 44px. `viewport-fit=cover` is set; `maximum-scale` is
deliberately not, so pinch-zoom stays available.

## Language and theme

Both are one symbol, in the top bar and on the sign-in screen alike — a globe
that switches language, and a moon or sun that switches theme. Each names what you will *get*, not what you are in.
Words were the first attempt and read as clutter: a bar that already carries a
wordmark, a POS code, a bell and an outlet name does not need two more text
elements competing with them. The words survive as `title` on hover, as the
accessible name, and as full text items in the account menu on mobile.

The theme is **light by default**, and has exactly two states. There used to be
a third, `system`, following `prefers-color-scheme`. It could not survive the
change: one symbol can say "you are light, tap for dark", but it cannot also
say "you are following the operating system, which currently means light". A
`system` value stored by an earlier build is read as light.

## Foundations

| Foundation | Where |
|---|---|
| Bangla is the **source locale** | `src/i18n/locales/bn.json` is authored first; `npm run i18n:check` fails the build on any missing or untranslated English key (238 keys) |
| **Numeral rule** — quantities localise, identifiers never do | `src/i18n/format.ts` plus an i18next formatter, so `{{count, qty}}` renders `৪` in Bangla while POS code, MSISDN, OTP and transaction IDs stay Latin and monospaced for dictation and cross-system matching. 17 unit tests pin both halves |
| Bangla-keyboard input is **normalised** | `formatIdentifier()` turns `২০০৬০৭৯৪` into `20060794` on every keystroke |
| Layout sized to **Bangla metrics** | `--lh-body: 1.7` Bangla / `1.55` English, keyed off `html[lang]`. No control has a fixed height |
| Only **Bangla is bundled** | English is its own 12 kB gzip chunk, fetched the first time somebody switches. Nearly every retailer stays in Bangla, and 911 keys of UTF-8 Bangla was the largest single thing in first load |
| Fonts are **bundled, not CDN** | Noto Sans Bengali via `@fontsource`; conjuncts break on device fonts across Android OEMs |
| Server strings arrive **in both languages** | Every server-owned display string is `{ bn, en }` |
| Errors say **what to fix** | The server sends codes; `error.*` keys carry the remedy |
| **AA contrast** in both themes | Verified on composited colours including `opacity`, and on gradient stops — an audit that only reads `getComputedStyle().color` misses both |

## Icons and category colour

Icons are **duotone** — a filled mass under stroked detail. Line-only glyphs at
22px on a counter phone in daylight all collapse into the same grey scribble;
the mass is what makes a SIM read as a SIM.

Each of the ten groups has its own well/ink pair (`--cat-*`), so a 62-tile grid
is scannable by hue before it is read. Wells are low-chroma tints, inks the same
hue darkened past 4.5:1 against their own well; the lowest measured pair is
4.1:1, well clear of the 3:1 non-text threshold. Quick-action tiles invert the
pair — solid ink, light glyph — so the four things done most carry more weight
than the catalogue below.

## Brand

`--brand-bright` (`#00A651`/`#00B84D`, the logo and site green) reaches only
3.2:1 on white, so it carries icons, rules and gradient stops — never small
text. `--brand` is the darkened variant for anything text-bearing.
`--brand-panel` is separate again, because `--brand` flips *light* in dark theme
while the green panel must stay dark under white text.

## Structure

```
openapi/     teletalk-one.json — the contract; generates src/lib/apiRoutes.ts
src/
  app/       router, guards, error boundary, theme, offline, route announcer
  lib/       http client, generated routes, offline outbox, storage, logger
  i18n/      bn.json (source), en.json, formatters, init
  styles/    tokens.css (light + dark), global.css
  components/ Button, Field, Select, Alert, Stepper, Checkbox, Icon
              data.tsx — Panel, ResourceView, EmptyState, Skeleton, Metric…
  features/
    auth/    LoginPage, AuthProvider, api + mock, contract types
    shell/   AppShell (top + bottom nav), BrandPanel
    home/    HomePage, ServicesPage, ModulePage, ServiceTile, menu
    wizard/  the multi-step engine: useWizard, Wizard chrome, draft store
    activation/ the five SIM flows — specs, steps, e-SAF validation, api + mock
    recharge/ the five over-the-counter sales, on the same engine
    counter/ the read surface — ledger, stock, commission, sales, lookup,
             notifications, support, plus the notification store
    ops/     outlet operations — requisition, complaints, money, stock
             movements, customer 360, performance
    channel/ channel management — outlets, provisioning, users, territory,
             visits, POSM, geo-fence, devices
    lifting/ the distribution chain — state machine, eight desks, inventory, SR
    outbox/  React binding for the queue, plus the standing pending notice
    profile/ ProfilePage, ChangePasswordPage
  mocks/     the queue's transport router while the API is unset
  test/      setup, provider harness
```

`src/i18n`, `src/components`, `src/features/wizard` and `src/lib/outbox.ts` are
written to lift into `packages/` when the React Native retailer app joins the
monorepo. The outbox takes its transport and its clock as options for exactly
that reason — on mobile the queue persists to encrypted storage, not
sessionStorage.

## Not yet built

Real API integration (`openapi/teletalk-one.json` is the contract to freeze —
nobody outside this repo has confirmed it yet), token refresh-before-expiry,
and 33 of the 62 tiles. Real biometric capture cannot happen in a browser at
all and belongs to the React Native app; the web client records the reference
from an external BVS capture instead. Every tile that isn't built opens a
surface naming its roadmap phase.
