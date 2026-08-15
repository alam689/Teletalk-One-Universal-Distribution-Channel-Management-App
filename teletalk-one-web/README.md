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

`verify` runs typecheck → i18n parity → lint → tests → production build. Wire it
as the CI gate; nothing should merge that doesn't pass it.

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
| `/services/:moduleId` | Module surface; names its roadmap phase and required capability |
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
| **Diagnostics** | `lib/logger.ts`. `debug`/`warn` compile out of production — retailer screens carry MSISDN and NID, and the counter terminal is shared |
| **Bundle** | Route-level lazy loading plus a vendor split, so an app release doesn't invalidate the React and i18n chunks in every retailer's cache |

## Responsive

Two independent breakpoints, deliberately different — collapsing them into one
is what made the top bar overflow at 753px:

- **720px — navigation mode.** Below it a fixed bottom bar replaces the top nav, with `env(safe-area-inset-bottom)` padding for notched devices.
- **900px — chrome density.** Below it the language and theme chips and the outlet name fold into the account menu.

Verified for horizontal overflow across 320 / 360 / 375 / 414 / 480 / 540 / 600 /
660 / 700 / 720 / 721 / 760 / 800 / 860 / 900 / 901 / 960 / 1024 / 1200 / 1440.
Every touch target clears 44px. `viewport-fit=cover` is set; `maximum-scale` is
deliberately not, so pinch-zoom stays available.

## Foundations

| Foundation | Where |
|---|---|
| Bangla is the **source locale** | `src/i18n/locales/bn.json` is authored first; `npm run i18n:check` fails the build on any missing or untranslated English key (238 keys) |
| **Numeral rule** — quantities localise, identifiers never do | `src/i18n/format.ts` plus an i18next formatter, so `{{count, qty}}` renders `৪` in Bangla while POS code, MSISDN, OTP and transaction IDs stay Latin and monospaced for dictation and cross-system matching. 17 unit tests pin both halves |
| Bangla-keyboard input is **normalised** | `formatIdentifier()` turns `২০০৬০৭৯৪` into `20060794` on every keystroke |
| Layout sized to **Bangla metrics** | `--lh-body: 1.7` Bangla / `1.55` English, keyed off `html[lang]`. No control has a fixed height |
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
src/
  app/       router, guards, error boundary, theme, offline, route announcer
  lib/       http client, storage, logger
  i18n/      bn.json (source), en.json, formatters, init
  styles/    tokens.css (light + dark), global.css
  components/ Button, Field, Alert, Stepper, Checkbox, Icon
  features/
    auth/    LoginPage, AuthProvider, api + mock, contract types
    shell/   AppShell (top + bottom nav), BrandPanel
    home/    HomePage, ServicesPage, ModulePage, ServiceTile, menu
    profile/ ProfilePage, ChangePasswordPage
  test/      setup, provider harness
```

`src/i18n` and `src/components` are written to lift into `packages/i18n` and
`packages/ui` when the React Native retailer app joins the monorepo.

## Not yet built

Real API integration (the mock documents the contract to freeze in Phase 0),
token refresh-before-expiry, notification centre, and the offline outbox
(mobile). Every service tile opens a surface naming its roadmap phase.
