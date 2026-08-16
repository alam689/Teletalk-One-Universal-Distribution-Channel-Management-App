# Teletalk One — Universal Distribution Channel Management App

Frontend for Teletalk Bangladesh's distribution channel: one product, two
clients, one contract between them.

| | | |
|---|---|---|
| [`teletalk-one-web`](teletalk-one-web/README.md) | **Management portal** | React + Vite. Thirteen roles, 62 services, 320px to desktop. The lifting chain, channel management, reporting and every desk from the dealer to F&A. |
| [`teletalk-one-retailer`](teletalk-one-retailer/README.md) | **Retailer app** | React Native (Expo). One role — the counter — on a phone. Sales, activation, stock, money, complaints, and an offline queue that is a tab rather than a footnote. |

Both run against in-repo mocks. **No backend is contracted or called**; the API
surface exists as `openapi/teletalk-one.json` and a generated route table, and
CI fails if either client drifts from it.

```bash
cd teletalk-one-web       && npm install && npm run dev      # portal, :5173
cd teletalk-one-retailer  && npm install && npm start        # retailer app
```

**Live demo of the retailer app** —
<https://alam689.github.io/Teletalk-One-Universal-Distribution-Channel-Management-App/>

That is the app's web target, built by GitHub Actions on every push that
touches `teletalk-one-retailer/`. It runs against the in-repo mocks, holds
itself to a handset column on a wide screen, and contains no live customer
data. It is a way to open the work in a browser, not a release: the real
targets are Android and iOS.

Sign in with POS `20060794`, password `Tele@1234`, OTP `123456`. The portal's
README lists an account for each of the thirteen roles.

## What the two clients share

Deliberately, and load-bearing: the numeral rule, the org model and its
capability sets, the wizard engine, the flow and sale specs, e-SAF validation,
the offline outbox's semantics, every mock, the OpenAPI contract, both locale
files and the design tokens.

A requisition raised in the retailer app is approved in the portal. A product
code, an error key or a validation rule that drifted between them would be a
support call nobody could reproduce.

## The rules both clients keep

- **Bangla is the source locale**; English is the translation, and a parity check fails the build on drift.
- **Quantities localise, identifiers never do.** ৳ ১১,৭৩১.০৪ — but an MSISDN, NID, ICCID, POS code or transaction ID stays Latin and monospaced in both languages, because it is dictated over the phone and matched against BVS, CBS, DMS and ERP.
- **A service the session lacks the capability for is absent, not disabled.**
- **One idempotency key per mutation, reused on retry.** The queue holds intent, never outcome: nothing pending is ever rendered as done.
- **No screen invents an endpoint.** Every call goes through the generated contract table.

## Status

Each app carries its own honest account of what is built and what is not:

- [`teletalk-one-web/STATUS.md`](teletalk-one-web/STATUS.md) — the portal, phase by phase, with the open questions for Teletalk
- [`teletalk-one-retailer/README.md`](teletalk-one-retailer/README.md) — the retailer app, what it shares, what a handset made different, and what is not built

The whole of the remaining risk is the same in both: **no backend integration
exists.** BVS, EC/NID, CBS, DMS, Telepay/EVC, ERP, MNP and SMS are a document
and a mock.
