# DGD non-custodial escrow signing (cstore)

How a DGD Marketplace order settles. The platform **never holds a private key**:
the buyer funds a party-owned multisig escrow, and release requires threshold
PSBT signatures produced in the parties' own wallets (DGD-QT), off-platform.

Spec: `Client_Signing_UI_Spec.md` in the backend repo (`DGDServices/DEX_Mart`).

## Pieces

| Layer | File | Role |
|-------|------|------|
| Bridge to dgd-core | `src/config/dgd.js`, `src/services/dgdCoreClient.js` | Bearer-authed calls to the dgd-core funds API; **`DGD_CORE_AUTH_TOKEN` stays server-side** |
| REST endpoints | `src/controllers/dgdEscrowController.js`, `src/routes/dgdEscrowRoutes.js` | `/api/dgd-escrow/:orderId/*` — open, get, check-funding, propose-release, payout-psbt, sign-payout, open-dispute, refund, mediate |
| Order fields | `src/models/Order.js` | `dgdEscrowId`, `dgdEscrowAddress`, `dgdExpectedSats`, `dgdEscrowState` |
| Signing panel | `public/js/dgd-signing-panel.js` | Reusable, zero-dependency `DgdSigningPanel`; state-driven UI |
| Order-page wiring | `public/js/app.js` (`showDgdEscrowFlow`) | DGD orders branch to open-escrow → mount the panel |

## Flow (buyer's session)
```
order placed (cryptocurrency = DGD)
  → dgdExpectedSats is set on the order at creation time (price × qty → sats)
  → showDgdEscrowFlow(): collect buyer DGD pubkey + payout address
    (seller key resolves server-side from the seller's profile — User.dgdPubkey /
     dgdPayoutAddress; the arbitrator resolves from platform config DGD_ARBITRATOR_*.
     A request body may override either, for platform tooling / demo.)
  → POST /api/dgd-escrow/:id/open  → escrow `created`, multisig address shown
    (2-of-3 buyer/seller/arbitrator when an arbitrator is configured — the platform
     default — otherwise 2-of-2 buyer/seller)
  → DgdSigningPanel.mount() drives the rest:
       created  → buyer funds the multisig address → "Check funding"
       funded   → "Propose release" / "Propose refund" / "Open dispute"
       disputed → (arbitrator view) propose a mediation payout split
       proposal → fetch unsigned PSBT → sign in DGD-QT → submit signed PSBT
                  (download .psbt / copy base64 / QR; "Signed N of threshold")
       released → success + broadcast txid
```
The seller completes the same signing step from their own session. Each party
verifies the payout outputs **in their own wallet** — the trust anchor.

## The `DgdSigningPanel`
```js
const panel = new DgdSigningPanel({
  orderId,                  // dgd-core escrow id (= order._id by convention)
  role: 'buyer',            // 'buyer' | 'seller'
  containerId: 'dgd-escrow-panel',
  getAuthToken: () => localStorage.getItem('token'), // Bearer JWT for the funds routes
  arbitratorMode: false,    // true (admin only): show the mediation form + sign as arbitrator
});
panel.mount();
```
- Never requests a key, seed, or passphrase.
- Three PSBT transports each way: file (`.psbt`), copy/paste base64, QR.
- Polls escrow state every 6s until terminal; maps server errors to clear text.
- Party actions on a funded escrow: **Propose release**, **Propose refund**
  (cancel-refund), **Open dispute**. All settle through the same sign-payout flow.
- `arbitratorMode: true` (mounted by an admin) replaces the party actions with a
  **mediation** form on a disputed escrow (one `address,sats` output per line);
  the arbitrator then co-signs the payout PSBT as the 3rd key. Mediation calls are
  admin-gated server-side, so a non-admin token gets a 401/403 the panel surfaces.

## Auth precondition (important)
The `/api/dgd-escrow/*` routes are guarded by `protect` (Bearer JWT) — non-custodial
signing is a per-party authenticated action. The buyer/seller must be **logged in**;
the panel and the open call attach `Authorization: Bearer <token>` from
`getAuthToken()`. Without a session the routes return 401 and the UI says so.

## Implemented since the first cut
- **Server-side seller + arbitrator key resolution** — `openEscrow` resolves the
  seller's DGD pubkey/payout from their profile (`User.dgdPubkey` /
  `dgdPayoutAddress`) and the arbitrator from platform config (`DGD_ARBITRATOR_*`);
  a request body still overrides either for tooling/demo. An arbitrator makes the
  escrow **2-of-3** (the platform default); without one it falls back to 2-of-2.
- **DGD amount on the order** — `dgdExpectedSats` is set when a DGD order is created
  (`orderController` → `dgdConfig.toSats(price × qty)`), no longer defaulting to `'0'`.
- **Dispute resolution routes** — both recovery paths are now surfaced:
  - `POST /api/dgd-escrow/:orderId/refund` — a buyer/seller proposes a **cancel-refund**
    (provider refund); both then sign the refund PSBT through the normal `sign-payout`
    flow → escrow `refunded` → order `refunded`.
  - `POST /api/dgd-escrow/:orderId/mediate` — the **arbitrator** proposes an explicit
    payout split on a disputed 2-of-3 escrow (`{ outputs:[{address,amount}], note? }`).
    Admin-only (the vetted arbitrator is neither buyer nor seller); the engine enforces
    the conservation invariant. One party co-signs → 2-of-3 met → escrow `resolved`.
  - **Panel parity** — `DgdSigningPanel` now drives both paths from the UI: a
    **Propose refund** button on funded escrows, and (in `arbitratorMode`) a
    mediation form on disputed escrows. Previously the routes existed but the panel
    only exposed release/dispute.

## Not yet wired (needs product decisions / live env)
- **Live dgd-core + DGD node** — `DGD_CORE_URL` / `DGD_CORE_AUTH_TOKEN` must point at
  a running dgd-core; end-to-end fund→sign→broadcast needs a real DGD node.
- **Arbitrator identity / vetting** — `mediate` is gated on the `admin` role; a
  dedicated vetted-arbitrator role + assignment per dispute is a product decision.
- **Independent security audit** of the funds path — the standing pre-launch gate.
