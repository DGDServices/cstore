# DGD Funds-Path Security Review — Scope & Checklist

**Status:** Pre-launch gate (NOT yet performed) · **Type:** Independent, external review required
**Owner:** DGDServices · **Created:** 2026-06-05

> The non-custodial DGD escrow is the only path that moves user funds and is the one
> feature under active development. The team has flagged an **independent funds-path
> security review** as a hard pre-launch gate (see [CHANGELOG.md](../CHANGELOG.md)
> "Known gaps"). This document scopes that review so it can be executed by an external
> reviewer (recommended: a Bitcoin/PSBT-literate firm — e.g. Trail of Bits, Cure53)
> and tracked to exit criteria. It is **not** a substitute for the review.

## 1. System under review

The marketplace (`cstore`) holds **no private key** and never signs payouts. It brokers
a party-owned multisig escrow on the external **`dgd-core`** service:

```
buyer/seller wallet (DGD-QT)        cstore (this repo)              dgd-core (external)
   │  signs PSBT externally           │  brokers, holds no key         │  builds PSBTs,
   │                                  │  bearer token server-side      │  tracks escrow state,
   ▼                                  ▼                                ▼  enforces invariants
 open → check-funding → propose-release/refund → payout-psbt → sign-payout → (mediate)
```

- Controller: [`src/controllers/dgdEscrowController.js`](../src/controllers/dgdEscrowController.js)
- Bridge client: [`src/services/dgdCoreClient.js`](../src/services/dgdCoreClient.js)
- Routes: [`src/routes/dgdEscrowRoutes.js`](../src/routes/dgdEscrowRoutes.js)
- Config: [`src/config/dgd.js`](../src/config/dgd.js)
- UI: `public/js/dgd-signing-panel.js` · Docs: [`docs/DGD_ESCROW_SIGNING.md`](../docs/DGD_ESCROW_SIGNING.md)

**In scope:** everything above, the `cstore ↔ dgd-core` trust boundary, key resolution,
and the order-state coupling. **Out of scope but must be reviewed separately:** the
internals of `dgd-core` itself (PSBT construction, multisig descriptor, conservation
enforcement, chain monitoring) — request its own audit from the `digitalgold.co` repo.

## 2. Invariants the review must independently confirm

1. **No-key invariant.** `cstore` never holds, derives, or transmits any escrow private
   key, and never signs a PSBT. Verify by code + dependency review (no `bitcoinjs-lib`
   signing on escrow paths, no seed/xprv material in config or logs).
2. **Bearer-token confinement.** `DGD_CORE_AUTH_TOKEN` stays server-side and is never
   serialized to a response, the signing panel, or logs. (Client attaches it only as an
   `Authorization: Bearer` header — `dgdCoreClient.js:34`.)
3. **Conservation.** Mediation/payout splits cannot create or destroy value; the sum of
   outputs ≤ escrow balance minus fees. (Engine-enforced in `dgd-core` per the controller
   comment — must be confirmed end-to-end, not assumed.)
4. **Authorization.** Only buyer/seller may act on their order; only a vetted arbitrator
   may `mediate`. See findings F-2/F-3 below.
5. **Idempotency / no double-spend on retry.** A retried mutation must not produce a
   second on-chain action. See finding F-1.

## 3. Endpoint-by-endpoint checklist

For each `POST/GET /api/dgd-escrow/:orderId/*`, the reviewer confirms: authz (who may
call), input validation, idempotency, state-machine legality (can this transition happen
from the current escrow state?), and error/timeout handling.

| Endpoint | Authz today | Idempotency key passed? | Notes for reviewer |
|---|---|---|---|
| `open` | buyer or seller | n/a | Verify key-resolution (F-2): seller key from product owner, arbitrator from config → 2-of-3. |
| `GET /` | buyer or seller | n/a | Read-only; confirm no fund-moving side effect. |
| `check-funding` | buyer or seller | n/a | Flips order → `paid`. Confirm confirmation threshold (`minConf`) cannot be attacker-controlled to 0. |
| `propose-release` | buyer or seller | **NO (F-1)** | — |
| `GET payout-psbt` | buyer or seller | n/a | Confirm PSBT discloses no key material; safe to expose. |
| `sign-payout` | buyer or seller | **yes** (`order:role:sign`) | Confirm a signed PSBT for order A can't be replayed against order B. |
| `open-dispute` | buyer or seller | **NO (F-1)** | — |
| `refund` | buyer or seller | **NO (F-1)** | — |
| `mediate` | **admin role only (F-3)** | **NO (F-1)** | Arbitrator ≠ buyer/seller; verify split conservation + that admin == the configured arbitrator key holder. |

## 4. Pre-identified findings & open questions (seed the review)

- **F-1 — Inconsistent idempotency on mutating funds calls.** *(cstore side RESOLVED
  2026-06-05.)* `proposeRelease`, `openDispute`, and `proposeRefund` now pass a stable
  per-operation key (`${order._id}:${role}:release|dispute|refund`), matching the existing
  `sign-payout` pattern (`dgdEscrowController.js`). `proposeMediation` is intentionally
  left without a fixed key — its `outputs` vary, so an arbitrator must be able to
  re-propose a corrected split. **Still for the reviewer to confirm:** that `dgd-core`
  actually de-duplicates on the `idempotency-key` header end-to-end, and how it treats a
  same-key request with a *different* body. Covered by `tests/dgdEscrowController.test.js`.
- **F-2 — Seller/arbitrator key resolution trust.** `resolveSellerId` falls back to
  `DEFAULT_PLATFORM_SELLER_ID`, then to *any* admin user. Review whether a misconfigured
  fallback could route a payout key to the wrong party. Confirm buyer/seller pubkeys read
  from profiles are validated (format/network) before reaching `dgd-core`.
- **F-3 — Arbitrator == `admin` role.** `mediate` is gated on `req.user.role === 'admin'`,
  a placeholder. Any admin can propose a dispute split. A dedicated, per-dispute,
  vetted-arbitrator assignment is still a product decision (CHANGELOG "Known gaps").
- **F-4 — Order/escrow state coupling.** The controller mirrors escrow state onto the
  `Order` (`paid`/`delivered`/`refunded`). Confirm a stale/false `dgd-core` response can't
  mark an order delivered without funds actually settling.
- **Q-1** — Is the `cstore ↔ dgd-core` channel authenticated **both** ways (does `cstore`
  verify it's talking to the real `dgd-core`, e.g. TLS pinning / mTLS), or only via the
  outbound bearer token?
- **Q-2** — Replay/expiry of the PSBT returned by `payout-psbt`.
- **Q-3** — What happens to escrow funds if `dgd-core` is unreachable mid-flow (the client
  has a 15s timeout and throws `DgdCoreError`)? Confirm no partial/ambiguous fund state.

## 5. Exit criteria (gate is met when)

- [ ] Independent reviewer engaged and scope above confirmed (incl. separate `dgd-core` audit)
- [ ] Invariants §2 (1–5) confirmed end-to-end on testnet with live `dgd-core` + DGD node
- [ ] F-1…F-4 resolved or formally risk-accepted by the owner
- [ ] Q-1…Q-3 answered and documented
- [ ] No outstanding High/Critical findings; report archived in `/audit`
- [ ] Re-test of all `/api/dgd-escrow/*` paths against the reviewed build

---
*This is a planning artifact. Update §4/§5 as the review proceeds; link the final report here.*
