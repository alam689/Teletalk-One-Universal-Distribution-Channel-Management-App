# Teletalk One — retailer app

The counter in a pocket. React Native (Expo SDK 57), TypeScript strict, Bangla
first, offline by default.

This is the second client of the same product. The management portal in
`../teletalk-one-web` serves thirteen roles on a desk; this serves one role in a
shop, and the difference between them is the whole design.

```bash
npm install
npm start          # then press a for Android, i for iOS, w for the browser
npm run verify     # typecheck → i18n parity → API contract → tests
```

Sign in with POS `20060794`, password `Tele@1234`, OTP `123456`.

## What it does

Everything in the `RETAILER` capability set, and nothing else:

| Group | Screens |
|---|---|
| **SIM** | Activation, replacement, ownership change, plan migration, customer search |
| **MNP** | Port in, port out |
| **Sales** | Recharge, flexiload, powerload, TBPS, scratch card, product sale |
| **Stock** | SIM stock, product stock, requisition to the dealer |
| **Money** | Commission and statement, wallet, outstanding |
| **Reports** | Transactions, sales, target |
| **Campaigns** | Campaigns, offers |
| **Service** | Raise a complaint and track it, notifications, support |
| **Chrome** | Home, catalogue, the outbox, profile |

An item the session lacks the capability for is **absent**, not disabled. A
greyed-out row on a counter phone is a question the retailer has to ask somebody
about; an absent one is simply not part of their job. The gate is generic, so an
SR or a sub-dealer signing in sees their own subset rather than a screen full of
things that will refuse them.

## What it shares with the portal

Two thirds of this app is the portal's own code, moved across unchanged because
it never touched the DOM:

- `i18n/format.ts` — the numeral rule, byte for byte
- `features/auth/{roles,authTypes,demoAccounts,authApi,authMock}.ts` — the org model
- `features/activation/*` — flow specs, e-SAF validation, the transaction mock
- `features/counter/*` and `features/ops/*` — types, API and mocks for the read surface
- `features/wizard/{useWizard,types}.ts` — the wizard engine
- `lib/{useResource,logger,apiRoutes}.ts` and `openapi/teletalk-one.json`
- Both locale files, extracted from the portal's, so a string that exists in
  both apps has one wording

That is deliberate and it is load-bearing: a requisition raised here is approved
there, and a product code, an error key or a validation rule that drifted
between the two would be a support call nobody could reproduce.

**The design tokens are the same values too.** A retailer who uses the portal on
a counter PC and this app on a phone is looking at one product; two palettes
that drifted apart would be the first thing to say otherwise. There is no
cascade here, so the equivalent of the portal's stylesheet is
`components/ui.tsx` — one place that knows what a heading, a card, a button and
a field look like.

## The home screen

It is the shape every banking and MFS app in this market uses — a green brand
band, the account strip riding on it, and a white sheet pulled up over the band
carrying a three-column grid of everything you can do, with a raised action in
the middle of the tab bar.

That is deliberate, and it is the one place this app does **not** follow the
portal. A retailer moves between four or five of these apps on the same handset
in a working day; a home screen that puts the grid where the others put it is a
home screen they can already use. What was here first — metric tiles, a short
row of shortcuts, everything else two taps further in — was a dashboard, and a
counter does not need a dashboard.

Two things are kept that the bank apps do not have, because a retailer's job is
not a customer's:

- **The float, today's commission, stock and the queue** sit in one line under
  the account strip. They are the reason the app gets opened at all.
- **The offline and queued banners** sit above the grid, where they cannot be
  scrolled past.

The raised button is a recharge — the transaction a counter does forty times a
day, and the only one that deserves to be one tap from anywhere. It is a real
control at 60pt with a label, and it is absent for a session that cannot sell
airtime rather than sitting there refusing.

Where a bank app carries an advert, this carries the one message that prevents
the fraud this channel actually sees: nobody from Teletalk ever asks for an OTP.

## What is different, and why

Every difference below is a handset fact, not a preference.

**Storage is synchronous, on purpose.** The outbox and the wizard drafts were
written against `sessionStorage` — a synchronous read inside a reducer. React
Native has neither. Rather than thread promises through the queue's flush loop,
`lib/storage.ts` reads every declared key into memory once at boot and serves
reads from there; `App.tsx` awaits that before the first screen mounts. That is
the whole reason the app has a splash state.

**The vault is the OS keystore.** A queued activation body carries the
customer's NID and a draft carries one before it is even submitted. The portal
kept these in `sessionStorage` because a counter terminal is shared; the phone
equivalent of that protection is the Keychain / Keystore, which is what
`vault` is. Preferences — language, theme, last POS code — go to AsyncStorage,
because none of them identify anybody.

**Connectivity is `isInternetReachable`, not `navigator.onLine`.** The portal
could only ask whether a network interface existed, which on a phone is almost
always yes and almost always useless. NetInfo can answer the question that
matters: the handset is on a tower and the tower is not passing traffic. That is
the normal failure in the field.

**Idle is measured by backgrounding.** The portal armed a timeout on every
pointer and key event because a counter PC is walked away from mid-task. A
phone is not — it goes in a pocket, and the OS may freeze our timers the moment
it does. So the elapsed time is computed on the way back in. Thirty minutes
rather than fifteen, but not absent: this app can activate a SIM against a
customer's NID, and a phone left on a shop counter is the risk the portal's
timeout was written for.

**The outbox is a tab, not a banner.** On a handset the queue is not an edge
case; it is the normal state of a shop with one bar of signal. "Has my
transaction gone through" is a question the retailer asks several times a day,
so it has a place to be answered, with the count on the tab badge.

**The biometric step is still honest.** A fingerprint reader on the handset
identifies the *retailer*, not the customer — BVS enrolment is a capture against
the citizen's record on a certified device. So the step asks for the reference
that device gives and says why, the same position the portal took for a
different reason. This is the one screen that could change once a certified
capture SDK is in the contract.

## The rules that did not change

- **Bangla is the source locale.** English is the translation. `npm run i18n:check` fails the build if they drift.
- **Quantities localise; identifiers never do.** ৳ ১১,৭৩১.০৪ and ১৪৮ in Bangla — but an MSISDN, NID, ICCID, POS code or transaction ID stays Latin and monospaced in both languages, because it is dictated over the phone and matched against BVS, CBS, DMS and ERP, none of which read Bengali digits.
- **One idempotency key per mutation, reused on every retry.** A double tap queues one entry. Only transient failures retry. Being offline does not spend an attempt. `src/lib/outbox.test.ts` is where those four claims are kept honest.
- **The queue holds intent, never outcome.** Nothing pending is rendered as done, anywhere, in any wording. A retailer must never hand over a SIM or take the change on the strength of a screen that lied.
- **44pt minimum on every target.** This app is used one-handed, outdoors, by someone holding a customer's NID in the other hand.
- **No endpoint is invented.** Every call goes through `API_ROUTES`, generated from `openapi/teletalk-one.json`; `npm run contract:check` fails on drift.

## Layout

```
App.tsx            boot order: storage → i18n → mock transport → outbox
src/
  shell/           navigation (tabs + stack), the tab bar, header controls
  theme/           tokens and the theme provider
  i18n/            format rules, locales, init
  lib/             storage, net, http, outbox, logger, useResource, apiRoutes
  components/      Icon (react-native-svg) and the primitive kit
  features/
    auth/          provider, sign-in, org model, mock
    home/          home, catalogue, the menu
    activation/    the six SIM flows on one wizard
    recharge/      the six over-the-counter sales on one screen
    counter/       the read surface — eleven screens
    ops/           requisition, complaints, wallet
    outbox/        the queue, as a tab and as a banner
    profile/       outlet, security, the two switches
    wizard/        the engine, shared with the portal
  mocks/           queued mutations → the right in-repo mock
```

`src/shell/` rather than `src/app/`: Expo Router claims `src/app` as a routing
directory, and this app does not use it.

## Verification

`npm run verify` runs typecheck → i18n parity → API contract → tests.

Tests are Jest with `jest-expo`. The queue, the catalogue gate and the sign-in
screen are covered; the sign-in test drives all three steps the way a retailer
does, including the failure that names its own remedy. Note that Testing Library
14's `render` and `fireEvent` are **asynchronous** under React 19 — every call
is awaited, and the mocks' deliberate latency is why `asyncUtilTimeout` is
raised in `src/test/setup.ts`.

Everything else has been verified by driving the app in the browser target
(`npm run web`): sign-in, a recharge queued and settled through the real queue,
and the outbox reporting it confirmed. There is no device-farm run yet, and
nothing here has been in a shop.

## What is NOT built

1. **All backend integration.** BVS, EC/NID, CBS, DMS, Telepay/EVC, ERP, MNP,
   SMS — none contracted, none called. The app runs against in-repo mocks and a
   release build without `EXPO_PUBLIC_API_BASE_URL` says so loudly.
2. **Real biometric capture.** Needs a certified device SDK and a contract
   decision. See above.
3. **Push notifications.** The feed is polled. Push needs a project id, a
   credential decision and a server that sends them.
4. **A store build.** No signing, no EAS profile, no icons beyond the Expo
   defaults, no store listing.
5. **Device testing.** Verified in the Expo web target and under Jest. Not on a
   physical Android handset, which is where every remaining layout bug lives.
6. **Deep links.** The scheme is registered (`teletalkone://`) and nothing
   routes on it yet.
