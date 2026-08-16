# Teletalk One — frontend status

**As of:** 16 August 2026
**Component:** `teletalk-one-web` — React management portal (web)
**Phase complete:** FE-0 · FE-1 · FE-1.1 · FE-1.2 · FE-2 · FE-3 · FE-4 · **FE-5 — the web client is finished**
**Phase next:** the React Native app, or nothing. See §2.

---

## 1. Snapshot

**All 62 tiles in the catalogue are built.** Every service in the Proposed
Scope of Development opens a working screen rather than a stub.

That sentence needs one qualifier said plainly, because it is the one that
matters: **every screen runs against an in-repo mock.** Nothing in this
application has ever spoken to BVS, EC/NID, CBS, DMS, Telepay or ERP. The
feature surface is complete; the integration is at zero.

| | State |
|---|---|
| Sign-in, session lifecycle, routing, error handling | Production grade |
| Bangla/English bilingual foundation · responsive | Production grade |
| Role & capability model (13 roles) | Production grade |
| Wizard engine · offline outbox · read layer | Production grade |
| **All 62 catalogue tiles** | Built, against the mock |
| SIM & MNP — 6 flows on one engine | Built |
| Counter sales — 6 channels on one spec | Built |
| The lifting chain — 8 desks, inventory, SR | Built |
| The read surface — 13 screens | Built |
| Outlet operations — requisition, complaints, money, stock movements, 360, performance | Built |
| Channel management — 9 tiles including location capture | Built |
| **Backend integration** | **Mock only — contract published, not confirmed** |

### Quality gates

`npm run verify` — typecheck → i18n parity → css imports → API contract → lint →
tests → build.

| Gate | Current | FE-4 | FE-3 |
|---|---|---|---|
| TypeScript | clean, `strict: true` | clean | clean |
| i18n parity (bn ↔ en) | 922 keys, in sync | 911 | 669 |
| CSS import check | 18 stylesheets | 18 | 16 |
| API contract check | **64 operations, spec and client in sync** | 63 | 31 |
| **Contrast check** | **32 pairs, both themes, lowest 3.18:1** | — | — |
| ESLint | 0 errors, 7 warnings (all `react-refresh` on provider files — expected) | same 7 | same 7 |
| Tests | **241 passing across 19 files** | 235 / 18 | 200 / 16 |
| Production build | `react` 207 kB / 67.6 gzip · `i18n` 52.5 / 16.3 · **app 143.8 / 51.0** · English a separate 34.2 / 12.3 chunk | app 175.4 / 61.9 | app 134.9 / 48.4 |

First load dropped from 61.9 to 51.0 kB gzip in FE-5 by shipping Bangla only
and fetching English on demand. Nearly every retailer signs in and stays in
Bangla, so sending them the English strings was 12 kB of nothing.

---

## 2. What is left

FE-5 closed the last of the frontend items that did not need somebody else.
What remains needs a decision, a device, or a person who does this work for a
living.

**In order:**

1. **Confirm the contract.** 63 operations, all written by us. Five phases of
   frontend rest on a document nobody at Teletalk has read. Start with the BVS
   activation shape and the `Idempotency-Key` question.
2. **Put it in front of the people who do this work.** Twenty-three screens in
   FE-4 were modelled from a scope document in one sitting. A dealer, a field
   officer, a zonal in-charge and F&A will each find something wrong in the
   first ten minutes, and every one of those findings is cheaper now than
   after integration.
3. **Start the React Native app.** Biometric capture cannot happen in a
   browser, so the activation flow is provably incomplete until it exists. The
   wizard, outbox, i18n and validation were written to lift into `packages/`;
   nothing has tested that claim, and it is the only substantial frontend work
   left anywhere.
4. ~~Split the locales.~~ Done in FE-5 — first load is 11 kB gzip lighter.

---

## 3. What FE-2 delivered

### One object, eight desks
The chain is modelled as a **lifting request moving through stages**, not as
twelve screens. What the app replaces is not the forms — it is the *handover*:
who has it now, what the last person did, and when. So the request carries its
own history, every entry names an actor, and `LiftingDeskPage` is one component
that all eight tiles route to.

A ninth desk would be an entry in `deskSpec.ts` and nothing else.

### Separation of duties, enforced in three places
`roles.test.ts` already pinned it in the capability model. FE-2 adds it to the
state machine (`liftingStates.test.ts`) and to the screens
(`lifting.test.tsx`) — a desk offering a button the state machine forbids is
the same failure as the state machine being wrong.

**One real gap was found doing this.** A dealer holds `lifting.challan`,
because they issue challans for their own outbound deliveries to retailers. The
chain's challan step is the warehouse dispatching goods *to* them — so without
a rule, a dealer could issue the delivery note for the consignment they were
themselves receiving. `canAct` now states the rule generally: whoever raised a
request may act only on the dealer-side stages. Worth raising with whoever owns
the capability matrix, because the same shape may exist elsewhere in it.

### Every action goes through the outbox
A field officer recommends demand from a weak-coverage upazila and a zonal
in-charge approves from a car. An approval that silently did not happen means a
dealer waiting a week for a truck nobody dispatched — so lifting actions get
the same idempotency key, the same queue and the same never-report-it-done-early
rule as a recharge. The mock replays a settled key rather than acting twice,
because an approval applied twice would advance the chain two desks.

### Rules the email process relies on a human remembering
Now testable, and each one is a real failure mode:

- **A return needs a reason.** A return with no reason is the email thread
  again.
- **Approval cannot exceed the request**, and the cut is shown struck-through
  beside the approved figure, so a dealer sees what they lost in one glance.
- **The deposit must match the approved value.** A mismatch here becomes an F&A
  reconciliation three desks later.
- **Returning stops once F&A has cleared the money.** After that, "send it back
  to the dealer" is an accounting event, not a button.
- **Demand is raised in packs**, because the warehouse ships in packs and a
  demand for 37 SIMs is not a thing anyone can fulfil.

### Inventory and SR
Inventory shows `onHand` beside `allocated` rather than subtracting one from
the other: they answer different questions, and the second is what the zonal
in-charge is approving against. The SR route puts the outstanding balance on
the stop, because that is why the SR is standing there.

---

## 4. What FE-3 delivered

Ten tiles, deliberately chosen as the ones the existing engines already made
cheap. Total new code is about 11 kB in the bundle; most of the growth is the
Bangla strings.

### Two more specs, no new engine
- **Scratch card** is a `saleSpec` entry — but it needed one honest addition.
  A scratch card is *a piece of card sold off the shelf*, not value sent to a
  number: the customer types the PIN into their own handset later. So the spec
  grew a `requiresMsisdn` flag, the sale screen hides the number field, and
  `msisdn` became optional on the recharge contract. Asking a retailer for a
  number they do not have is a field they invent something to get past.
- **MNP port-out** is a `flowSpec` entry: number → identity → biometric →
  review → done. No e-SAF, because the subscriber is leaving and there is
  nothing to enrol. Identity and biometric stay, because this is the
  transaction that hands someone else's number to whoever is at the counter.

### One stock screen instead of two
`/stock/sim` became `/stock?type=`, and `SimStockPage` became `StockPage` with
a type. A SIM batch carries a serial range — the retailer's real question is
whether the shelf matches the system — and a product batch does not, so the row
omits the range rather than rendering an empty one.

### Seven read screens on the FE-1.2 kit
Each is small because `useResource` and `ResourceView` already exist. What each
one is *for*, in one line:

| Screen | The question it answers |
|---|---|
| Commission statement | Where did the money go? The **settlement reference** is the point — it is what a retailer quotes on the phone, and an unpaid month says "not yet credited" rather than leaving a blank |
| Outstanding | What do I owe, and how late am I? Lateness is stated in **days**, not just coloured red — a red number does not survive a counter screen in daylight |
| Target | Am I going to make it? **Days left** is a headline metric, because it is the number that changes what a retailer does on the 27th |
| Campaigns / My campaign | Two views, one endpoint. `enrolled` splits them; two endpoints would have the same data disagreeing with itself the first time one was cached |
| Offers | What can I sell this customer? The dial code stays **Latin and monospaced** — the customer types it into their own handset |
| MNP status | Has my port gone through? MNP completes at the regulator's pace, and a refused request carries the operator's own reason in both languages |
| Product stock | What is on the shelf that is not a SIM? |

---

## 5. What FE-4 delivered

Twenty-three tiles, and unlike FE-3 none of them were free. Four needed
something the application had never had.

### A second approval chain, at a third of the length
Requisition is stock moving *down* the channel against an allocation already
paid for — so it has no deposit, no invoice and no revenue assurance. Three
stages and one approver. It reuses the lifting chain's shape without reusing
its machinery, because pretending a 3-step flow is an 8-step one would have
cost more than it saved.

### An SLA clock that counts down
Complaints **count down to the deadline**, not up from the raise time. Elapsed
time is a fact; time remaining is what makes somebody act, and a breach shows
as a breach rather than as arithmetic the retailer has to do themselves. The
SLA is also stated *before* the ticket is raised, on the category selector.

### A stock count that is not a transcription exercise
The system's own figure is **hidden until the count is submitted**. Show it
first and the retailer reads the screen, types the same number back, and the
variance is always zero. The whole value of a stock count is the number that
does not match.

### Location, without a map
`lib/geo.ts` gives a coordinate pair, an accuracy radius and a great-circle
distance. **There is deliberately no mapping library**: 150 kB of JavaScript
plus third-party tile requests, in an app built for a 2G counter phone with a
no-external-request policy. The accuracy figure is shown rather than hidden
behind a tick, because a fix taken indoors behind a shutter can be a kilometre
out — and a screen that says only "location captured" turns that into evidence
it is not. Field visits carry the **distance from the outlet's registered
point**, which is what makes a logged visit checkable rather than assertable.

### A hold is a lock with a clock
Choice number's interesting part is not the search. Two counters can press
*reserve* on the same number in the same second, and no client can arbitrate
that — so the server decides, the loser gets `numberTaken`, and that is a state
this screen renders rather than a race it pretends cannot happen. Written into
the contract as a MUST.

### Smaller decisions worth keeping
- **The admin screen cannot mint an admin.** `ASSIGNABLE_ROLES` excludes it;
  one compromised session should not be able to grant the everything-role.
- **Enlisting a retailer does not make them able to trade**, and the
  onboarding screen says so. An outlet with no BVS id and no DMS access is the
  most common "the app is broken" call.
- **Deductions are their own line** on a settlement, never netted away — that
  is the figure outlets dispute.
- **A bank or MFS collection requires a reference.** An unreconcilable
  collection is an argument three weeks later.
- **Customer 360 keeps the NID masked**, exactly as the lighter lookup does.
  A richer screen leaking an identity number is a worse incident, not a
  permitted one.

---

## 6. What FE-5 delivered

Five items, four of which had been sitting in "what is NOT built" since FE-1.

### It stopped looking like a phone app in a browser
Every screen was mobile-first and none of them used a desktop window. A
1120px shell rendered a 620px column of fields with white space either side.
From 900px:

- **The wizard is a rail and a main column.** The rail answers *where am I and
  how much is left*; the main column carries the one thing being asked for.
  The stepper stands up vertically in the rail and lies down again below the
  breakpoint.
- **Forms are two columns**, with legends, alerts and button rows spanning the
  full width — a row of buttons occupying half a form reads as belonging to
  the field beside it.
- **The e-SAF is three columns** past 1100px. Fourteen fields in one column is
  a scroll nobody finishes.
- **A queue sits beside the record it opened.** Replacing the list with the
  detail throws away the context that made the queue worth having; below
  1100px it still replaces it, because there is no room for both.

**A real bug fell out of this.** The shared form and list styles lived in
`lifting.css`, but ops and channel screens use them too and import only their
own stylesheet — so on a route that never loaded the lifting chunk, the
collect-payment form rendered completely unstyled at full container width.
Those primitives now live in `components/data.css`, which every screen already
pulls in, and the two that carried a feature prefix are `.form` and
`.form__actions`.

### Token refresh before expiry
The token was short-lived and the only thing that noticed was a 401 — which
arrives *during* whatever the retailer is doing. `AuthProvider` now refreshes
at 80% of the token's life. A failure is logged and retried rather than
escalated: the 401 path is still there as the backstop.

### A crash reporter that cannot leak a customer
`setCrashReporter` attaches a sink; nothing is attached by default, because
shipping a reporter that phones a third party from a retailer's device is
Teletalk's decision to make explicitly. Every report is **scrubbed by shape**
rather than by field name — a field name only helps when the value is where
you expected it, and in a stack trace it never is. Unhandled rejections and
uncaught errors route through the same place.

### Contrast is a gate, not a memory
`npm run contrast:check` measures 32 declared pairs in both themes and fails
the build below AA. It composites translucent foregrounds properly, which is
what the manual check could not do.

**It found two real problems on its first run.** Input borders were `--rule`
at **1.19:1** — effectively invisible to a low-vision retailer looking for the
field on a bright counter — and the focused border was `--brand-bright` at
2.64:1. Controls now use a new `--rule-control` token at 3.18:1, and focus
uses `--focus`, which was already compliant. Inputs are visibly more defined
than they were, and that is the point.

### The last two demo accounts
`onlineDealer` (`30110001`) and `subDealer` (`30120001`). All 13 roles in the
org model can now be signed into and reviewed.

### Symbols in the top bar, and a two-state theme
The language and theme controls were labelled chips. In a bar that already
carries a wordmark, a POS code, a bell and an outlet name, two more text
elements read as clutter and squeezed the outlet name. They are now a globe
and a moon/sun, each naming what you will *get* rather than what you are in.
The words remain as `title`, as the accessible name, and as full text items in
the account menu on mobile. The sign-in screen has the same pair — it has its
own bar, so it needed the same change, and `.iconbtn` moved from `shell.css`
into the globally imported `app-chrome.css` because the signed-out shell never
loads the signed-in stylesheet. `.chip` and `.chip--compact` came out with it:
those two buttons were the last things using them.

The theme lost its third state along with the words. `system` was
unrepresentable in one symbol — an icon can say "you are light, tap for dark",
but not "you are following the OS, which currently means light". Light is now
the default, a stored `system` reads as light, and the duplicate dark palette
under `prefers-color-scheme` came out of `tokens.css`: 63 lines, and one less
chance of a dark flash before the provider mounts.

### Two defects the screenshots caught
`.split` applied its two-column grid unconditionally, so a queue with nothing
selected sat in 456px of a 1120px shell with 640px of nothing beside it. The
grid now belongs to `.split--detail`, which the pages already set. And eleven
count strings said "1 products" in English; they are `_one` / `_other` pairs
now in both locales, which is what `count` was being passed for all along.

---

## 7. What is NOT built

1. **No tiles.** All 62 are built. What follows is everything else.
2. **All backend integration.** BVS, EC/NID, CBS, DMS, Telepay/EVC, ERP, MNP,
   SMS — none contracted, none called. 63 operations exist as a document and a
   mock. This is the whole of the remaining risk.
3. **Real biometric capture.** Impossible in a browser.
4. **React Native retailer app.** Built — `../teletalk-one-retailer`, Expo
   SDK 57. It is the counter's own capability set on a phone: the six SIM
   flows, the six over-the-counter sales, stock and requisition, money,
   reports, campaigns, complaints and the outbox as its own tab. Two thirds of
   it is this repo's code moved across unchanged, including the wizard engine,
   the org model, every mock and both locale files. What it does not have is a
   store build, push, a certified biometric capture, or a single run on a
   physical handset — see its own README.
5. **A crash-reporting *service*.** The client side is done and scrubbed;
   nothing is attached, because choosing a vendor is Teletalk's call.
6. **Browser-automation tests.** All 241 tests run in jsdom, which does no
   layout. Every responsive bug this project has found — including the
   unstyled form in FE-5 — was found by driving a real browser by hand.
   A Playwright suite would close that permanently and needs a dependency
   install this environment cannot do.
8. **Any field trial.** Every claim in this document is proven against a mock,
   in a browser, by the people who wrote it.
9. **File upload.** A deposit slip is entered as data and a POSM photograph
   is recorded by *name*. There is no storage endpoint, and adding one commits
   Teletalk to a retention decision nobody has made — a photograph of a shop
   front is personal data with a lifetime.
10. **A map.** Territory is a hierarchy and a geo-fence is a coordinate plus a
   radius. If a visual map is genuinely needed, it is a deliberate decision
   with a bundle cost, not a component swap.
11. **A performance budget in CI.** Bundle sizes are watched by hand.

---

## 8. Exit criteria

### FE-2
- [x] All eight desks on one screen and one state machine
- [x] Separation of duties enforced in the model, the state machine and the UI
- [x] Every chain action is queued, idempotent, and never reported done early
- [x] The audit trail names an actor and a time for every step
- [x] No horizontal overflow at 320–1440; every new control clears 44px
- [x] `npm run verify` green
- [ ] **Walked with the six roles who actually run this chain.** Not attempted.
      This is the FE-2 sign-off and the phase should not be called done without
      it — the desks are modelled from the deck, not from watching the work.
- [ ] AA contrast re-audited on composited output for the new surfaces

### FE-3
- [x] Every Phase-2 tile the existing engines already covered is now a working
      screen
- [x] No new engine, no new read layer — ten tiles for about 11 kB
- [x] No horizontal overflow at 320–1440 on any new screen
- [x] `npm run verify` green
- [ ] **The scratch-card model is an assumption.** The client treats it as a
      shelf sale with no MSISDN. If Teletalk dispenses a PIN electronically
      instead, that is a different transaction — see risk 9.

### FE-4
- [x] Every one of the 62 catalogue tiles opens a working screen
- [x] Location capture, with accuracy surfaced rather than hidden
- [x] No horizontal overflow at 320–1440 on any new screen
- [x] `npm run verify` green — 235 tests
- [ ] **None of it has been used by the people it is for.** Twenty-three
      screens were modelled from a scope document in one sitting. The
      requisition chain, the SLA windows, the POSM checklist, the subsidy
      lines and the performance weightings are all plausible and all unverified

### FE-5
- [x] The app uses a desktop window instead of floating a phone column in one
- [x] Token refresh before expiry
- [x] Crash reporting wired, scrubbed, and off by default
- [x] Contrast is a CI gate — and it found two real failures
- [x] All 13 roles have a demo account
- [x] `npm run verify` green — 241 tests, run twice to confirm stability

### Still outstanding from FE-1.1
- [ ] Timed activation run under 5 minutes on the low-end reference device
- [ ] Reviewed with 5 retailers from two zones

---

## 9. Risks and blockers

| # | Risk | Severity | Action |
|---|---|---|---|
| 1 | **No integration contract is confirmed. 63 operations, all ours, and now the entire product rests on them.** | **Highest** | This has been the top risk for five phases and has not moved once. There is no longer any frontend work that reduces it. |
| 2 | **Idempotency may not be implemented server-side.** Now carries approvals as well as money: an approval replayed twice advances the chain two desks. | **High** | Confirm in writing with the CBS, Telepay and DMS owners. |
| 3 | **The whole product is modelled from documents, not from observation.** The lifting chain from deck slides 6 and 7; the FE-4 screens from the Scope of Development. Nobody who does this work for a living has seen any of it. | **Highest** | Sit with a retailer, a dealer, a field officer, a zonal in-charge, an invoice officer, F&A and an inventory officer. This is now more valuable than any code. |
| 4 | **ERP invoice: generate or track?** The client records a number raised in ERP. If Teletalk One is to generate it, the invoice desk changes shape and a server-side sequence appears. | **High** | Open question 3. Probably the largest single cost variable left. |
| 5 | Biometric capture is impossible on web | **High** | Decide whether the React Native app starts in parallel |
| 6 | Regulatory clearance for biometric capture on a retailer-owned handset | **High** | Engage BTRC and the EC liaison |
| 7 | The eight external dependencies have owners outside IT&B | **High** | Each needs a named owner and a date |
| 8 | **A dealer holds `lifting.challan`.** Handled in `canAct`, but the capability matrix may have other shapes like it. | Medium | Review the matrix with whoever owns it |
| 9 | **Flexiload / powerload / TBPS / scratch card modelled on assumptions.** The client distinguishes them by denomination rules, a `channel` field, and whether a number is involved at all. If the real differences are separate balance pools, separate settlement or an electronic PIN, those are spec changes. | Medium | Confirm with the commercial team. Flagged in `saleSpec.ts` and in the contract. |
| 10 | The app demos as more complete than it is | Medium | Lead every walkthrough with §3 |

---

## 10. Decisions already made — do not relitigate

1. **Bangla is the source locale.**
2. **Quantities localise, identifiers never do.** Dates go through `Intl` with the Bangla locale — ১৬ আগস্ট ২০২৬, not ১৬ Aug ২০২৬.
3. **Navigation renders from a capability set, never a role string.**
4. **Unauthorized services are absent, not disabled.** `LockedService` is the one component every screen uses.
5. **`--brand-bright` never carries small text.** 6. **Never dim text with `opacity` on the brand panel.**
7. **Two responsive breakpoints, deliberately different** — 720px navigation, 900px chrome density.
8. **Tokens are never bypassed.** 9. **Access tokens live in memory only.** 10. **`debug` and `warn` compile out of production.**
11. **Drafts and the queue live in sessionStorage, cleared on sign-out.**
12. **The queue holds intent, never outcome.**
13. **The mock is the queue's transport in mock mode**, routed from `src/mocks/transport.ts` so the behaviour never depends on which route was opened first.
14. **API paths come from the generated table.**
15. **Identifying data never goes in a query string.**
16. **No charting library**, and **no mapping library**. Both would cost more
    in bundle and third-party requests than the thing they draw is worth on a
    2G counter phone; in both cases the numbers are printed beside the
    graphic and are the accessible reading.
17. **Control boundaries are held to 3:1, decorative rules are not.**
    `--rule-control` is the edge of an input; `--rule` divides rows that are
    already separated by spacing. `check-contrast.mjs` encodes the difference.
18. **Crash reports are scrubbed by shape, not by field name.**
17. **The lifting chain is one object, not twelve screens.** Adding a desk is a spec entry.
18. **The actor on a chain action comes from the token, never the body.** The mock sends it because it has no token; the contract says MUST.

### Guards that encode these
- `scripts/check-locales.mjs` · `check-css-imports.mjs` · `check-contract.mjs`
- `format.test.ts` — the numeral rule and the date rule
- `roles.test.ts` — separation of duties in the capability model
- `liftingStates.test.ts` — separation of duties in the chain, and every transition
- `lifting.test.tsx` — that the screens obey it
- `ServicesPage.test.tsx` — per role, every unpermitted service absent
- `useWizard.test.tsx` · `outbox.test.ts` · `useResource.test.tsx` · `ledger.test.ts`
- `flows.test.tsx` / `sale.test.tsx` — ten flows, one engine
- `esafValidation.test.ts` · `activation.test.tsx` · `counter.test.tsx`

---

## 11. Open questions for Teletalk

1. **Will the API honour `Idempotency-Key` by replaying the original response?**
2. **Does Teletalk One generate the ERP invoice, or track one generated in ERP?**
3. **Does the real lifting chain have steps the deck omits?** A credit note, a partial dispatch, a second approver above a value threshold, a return-to-warehouse.
4. **Must a scanned deposit slip be stored, or is the slip number enough?**
5. What actually distinguishes flexiload, powerload and TBPS?
6. Will the API return server-owned strings in **both** languages?
7. Does the retailer app run on retailer-owned handsets or Teletalk-issued devices?
8. Which MFS/banking rails are approved for dealer deposits?
9. Is the EC/NID lookup available with date of birth as a second factor, and does it return `simsOnNid`?
10. Who owns the SIM stock `lowThreshold` and the inventory `reorderLevel` — per tier, per zone, or fixed?

---

## 12. Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Password `Tele@1234`, OTP `123456` for every account.

**The counter** — sign in as `20060794`. Scratch card asks for no number at
all (it is a shelf sale); every other sale does. Activation: SIM serial
`8988015123456789012`, NID `1234567890`, date of birth `1994-03-17`. Failure
paths trigger on the last digits of an identifier (NID `…0000` not found,
`…9999` blocked, `…8888` at the SIM limit; serial `…00` already active, `…11`
not in stock; BVS reference `…00` mismatched; recharge over ৳1,000 declined).

**The lifting chain** — one request is seeded at every desk, so the whole chain
is walkable in one sitting. Sign in as each in turn:

| POS | Role | Desk |
|---|---|---|
| `30020001` | Dealer | Raise demand · deposit slip · the full ledger |
| `30030001` | Field officer | Recommend · verify deposit |
| `30040001` | Zonal in-charge | Approve, cutting quantity |
| `30050001` | Invoice officer | Record the ERP invoice · challan |
| `30070001` | F&A | Revenue assurance |
| `30060001` | Inventory officer | Challan · central and zonal inventory |
| `30010001` | Sales representative | Route |

**Everything else** — sign in as `30100001` (administrator) to reach all 62
tiles. Choice number: search `7777`. Field visit and geo-fence ask the browser
for a location; refusing the prompt is a tested path, not a dead end.

Note that mock state is per-tab and resets on a full reload — a demand you
advance stays advanced while you navigate inside the app.

Read `README.md` first.
