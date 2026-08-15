# Teletalk One — frontend status

**As of:** 15 August 2026
**Component:** `teletalk-one-web` — React management portal (web)
**Phase complete:** FE-0 Foundation + FE-1 shell
**Phase next:** FE-1.1 — Activation → e-SAF → first recharge

---

## 1. Snapshot

The application shell is production grade and the whole feature surface is
mapped, but **no business transaction is implemented yet**. All 62 service
tiles open a module surface that names its roadmap phase.

| | State |
|---|---|
| Sign-in, session lifecycle, routing, error handling | Production grade |
| Home, Services catalogue, Profile, Change password | Production grade |
| Role & capability model (13 roles) | Production grade |
| Bangla/English bilingual foundation | Production grade |
| Responsive web + mobile | Production grade |
| **Business transactions (activation, recharge, stock, …)** | **Not started** |
| **Backend integration** | **Mock only — no contract frozen** |

### Quality gates

`npm run verify` — typecheck → i18n parity → css imports → lint → tests → build.
Wire this as the CI gate; nothing merges without it.

| Gate | Current |
|---|---|
| TypeScript | clean, `strict: true` |
| i18n parity (bn ↔ en) | 238 keys, in sync |
| CSS import check | 11 stylesheets, all imported |
| ESLint | 0 errors, 7 warnings (all `react-refresh/only-export-components` on provider files — expected) |
| Tests | 53 passing across 5 files |
| Production build | clean; `react` 207 kB / 67.6 kB gzip, `i18n` 52.5 / 16.3, app 49.6 / 19.2 |

---

## 2. What is built

### Application shell
- **Routing** — React Router with `RequireAuth`, deep links, `?q=` search in the URL, 404, route-level lazy loading. Sign-in bundle excludes authenticated screens.
- **Session lifecycle** — restore on boot (survives hard reload at a deep link), idle timeout, cross-tab sign-out broadcast, single 401 handler.
- **HTTP layer** — timeout composed with caller-abort, bounded retry with jittered backoff on idempotent GETs only, `Retry-After`, error codes normalised onto `error.*` keys. Access token in memory only.
- **Error boundary** with static bilingual copy (it may be rendering *because* i18n failed). **Offline banner** short-circuits before any request.
- **Accessibility** — skip link, focus moved to `#main` on navigation, live-region route announcement, per-route document title, 44px minimum touch targets.

### Screens
| Route | State |
|---|---|
| `/login` | POS code → password → OTP, device binding, resend timer, attempt counter, lockout |
| `/` | Role-shaped home: stats, quick actions, catalogue preview |
| `/services` | Permitted services only, grouped, searchable |
| `/services/:moduleId` | Module surface — names phase and required capability; capability-checked on deep link |
| `/profile` | Outlet, proprietor, zone, territory, role, tier, security, permitted services |
| `/profile/password` | Live-ticking policy rules, current-password check, reuse rejection |

### Role & capability model
13 roles in `features/auth/roles.ts` — retailer, SR, dealer, online dealer,
sub-dealer, field officer, zonal in-charge, zonal invoice officer, inventory
officer, F&A revenue assurance, branch head, CSIM, admin.

`roles.test.ts` pins the **separation of duties** from deck slides 6 and 7: no
role holds two adjacent steps of the lifting chain, and whoever raises the
deposit slip never verifies it.

### Feature surface
62 services across 10 groups, including the 12-step lifting chain
(demand → recommend → approve → deposit slip → verify → ERP invoice → revenue
assurance → challan → central/zonal inventory → SR route → SR allocation).

---

## 3. What is NOT built

Be explicit about this with stakeholders — the app currently **looks** far more
complete than it is.

1. **Every business transaction.** All 62 tiles are stubs.
2. **All backend integration.** BVS, EC/NID, CBS, DMS, Telepay/EVC, ERP, MNP, SMS — none contracted, none called. `features/auth/authMock.ts` documents the intended shapes only.
3. **Offline outbox.** Specified, not built. Web has no queue; this is primarily a mobile concern but the engine belongs in shared code.
4. **Wizard engine.** Specified, not built. Required before any multi-step flow.
5. **Token refresh-before-expiry.** Session restores and 401s are handled; proactive refresh is not.
6. **Notification centre.** The bell renders a badge and does nothing.
7. **React Native retailer app.** Not started. **Fingerprint capture cannot run in a browser** — biometric activation must live there.
8. **Demo accounts for `onlineDealer` and `subDealer`.** Capability sets exist; no account to sign in as. 11 accounts for 13 roles.
9. **Real analytics/monitoring.** `lib/logger.ts` has the seam for a crash reporter; nothing is wired.

---

## 4. Next phase — FE-1.1

**Goal:** a retailer completes biometric activation and the customer's first
recharge in one session, on one login, in under five minutes — against the
30–40 minutes it takes today across BVS and Telepay.

This is the flow the 17-06-2025 letter exists to fund. It is also the flow that
earns the most reuse: four later flows are configurations of the same engine.

### Work items, in order

**1.1.1 — Wizard engine** (`packages`-ready, in `features/wizard/`)
Resumable, step-validated, abandonable multi-step engine. Steps declare their
own validation and their own "can I leave?" policy. State survives a reload
mid-flow.
*Done when:* replacement, MNP, ownership change and plan migration can each be
expressed as a config object with no engine changes.

**1.1.2 — Offline outbox**
Queue with an **idempotency key per mutation**, sync status, retry policy and
conflict handling. Activation and financial calls stay server-confirmed — the
queue holds intent, never assumes success.
*Done when:* a mutation submitted with the network off is queued, surfaced to
the user as pending, and settles exactly once when connectivity returns.

**1.1.3 — e-SAF form**
The longest, most validated form in the product. Bangla **and** English name
fields (NID carries both), structured address, consent capture, NID/biometric
data masked in every view.
*Done when:* a field retailer completes it unaided in Bangla on a low-end
device, and a partial entry survives an app kill.

**1.1.4 — Activation flow**
POS → customer NID → e-SAF → biometric capture (**stubbed on web**) → CBS
request → SIM active.
*Done when:* the happy path and every named failure path render a remedy, not
an apology.

**1.1.5 — Inline first recharge**
The point of the whole exercise: recharge is a step *inside* the activation
wizard, not a separate login.
*Done when:* median activation-to-first-recharge is under five minutes in a
timed run.

**1.1.6 — Contract hardening**
Publish the mock as an OpenAPI document and generate the client from it, so the
frozen contract is a file rather than a convention.

### Exit criteria for FE-1.1
- [ ] Timed run: activation + first recharge under 5 minutes, in Bangla, on the low-end reference device
- [ ] Offline: flow queues and settles exactly once; no double recharge under retry
- [ ] All five SIM flows expressible on the one engine
- [ ] `npm run verify` green, with wizard and outbox unit-tested
- [ ] AA contrast verified on composited colours in both themes
- [ ] Reviewed with 5 retailers from two zones — including one weak-coverage upazila

---

## 5. Risks and blockers

| # | Risk | Severity | Action |
|---|---|---|---|
| 1 | **No integration contract is frozen.** Every week of frontend work against invented shapes is rework risk. | **High** | Get one SPOC to confirm the BVS activation request/response shape. This is the single highest-value unblock available. |
| 2 | Biometric capture is impossible on web — the real activation flow needs the React Native app | **High** | Decide now whether the retailer app starts in parallel. FE-1.1 proves the engine and the form; it cannot prove BVS biometric. |
| 3 | Regulatory clearance for biometric capture on a retailer-owned handset | **High** | Engage BTRC and the EC liaison before FE-1.1 ships, not at UAT |
| 4 | The eight external dependencies (dual HLR, NID sync, CBS config, EVC AMC, devices, reporting infra, coverage, SR headcount) have owners outside IT&B | **High** | Each needs a named owner and a date; see the programme roadmap |
| 5 | The app demos as more complete than it is | Medium | Lead every walkthrough with §3 of this document |

---

## 6. Decisions already made — do not relitigate

Each of these was made for a reason that is easy to lose.

1. **Bangla is the source locale.** `bn.json` is authored first; English is the translation. Retrofitting Bangla into an English-designed layout breaks every button and table column.
2. **Quantities localise, identifiers never do.** Amounts, counts and dates render in Bengali digits; POS code, MSISDN, NID, SIM serial, OTP and transaction IDs stay Latin and monospaced — they are dictated over the phone and matched against BVS, CBS, DMS and ERP, none of which speak Bengali digits. Enforced centrally by an i18next formatter (`{{count, qty}}` / `{{msisdn, id}}`), not at call sites.
3. **Navigation renders from a capability set, never a role string.** Teletalk's real hierarchy can be modelled without a frontend release.
4. **Unauthorized services are absent, not disabled.** Hiding is presentation; the deep-link guard in `ModulePage` is the access control, because the URL is guessable.
5. **`--brand-bright` (#00B84D) never carries small text** — it is 3.2:1 on white. `--brand` is the darkened variant for anything text-bearing; `--brand-panel` is separate again because `--brand` flips *light* in dark theme.
6. **Never dim text with `opacity` on the brand panel.** White at 0.6 over `--brand-panel` composites to 2.97:1. Use the `--on-brand-soft` token.
7. **Two responsive breakpoints, deliberately different** — 720px switches navigation mode, 900px switches chrome density. Collapsing them into one is what made the top bar overflow at 753px.
8. **Tokens are never bypassed.** No component reads a raw hex value.
9. **Access tokens live in memory only.** localStorage holds language, theme and last POS code — nothing else.
10. **`debug` and `warn` compile out of production.** Retailer screens carry MSISDN and NID, and the counter terminal is shared.

### Guards that encode these
- `scripts/check-locales.mjs` — fails on any missing or untranslated key
- `scripts/check-css-imports.mjs` — fails on any stylesheet with no importer (added after deleting a component silently dropped the entire signed-out shell's styling while every other gate stayed green)
- `format.test.ts` — 17 cases pinning both halves of the numeral rule
- `roles.test.ts` — pins separation of duties
- `ServicesPage.test.tsx` — asserts, per role, that every unpermitted service is absent and no disabled tile is ever rendered

---

## 7. Open questions for Teletalk

1. Does Teletalk One **generate** the ERP invoice, or **track** one generated in ERP? This is the difference between an integration and a replacement, and it is probably the largest single cost variable in Phase 3.
2. Will the API return server-owned strings (product names, rejection reasons, complaint categories) in **both** languages? If BVS/CBS/DMS return English only, screens will be mixed-language no matter how well the client is built.
3. Does the retailer app run on retailer-owned handsets or Teletalk-issued devices? Determines the biometric path and the device-binding policy.
4. Which MFS/banking rails are approved for dealer deposits?
5. Confirm the idle-timeout value for a shared counter terminal (currently 15 minutes).

---

## 8. Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Read `README.md` first — it documents the demo accounts (one per role), the
brand contrast rules, and where each production concern lives.
