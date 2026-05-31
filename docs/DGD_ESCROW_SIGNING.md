# DGD non-custodial escrow signing (cstore)

How a DGD Marketplace order settles. The platform **never holds a private key**:
the buyer funds a party-owned multisig escrow, and release requires threshold
PSBT signatures produced in the parties' own wallets (DGD-QT), off-platform.

Spec: `Client_Signing_UI_Spec.md` in the backend repo (`DGDServices/DEX_Mart`).

## Pieces

| Layer | File | Role |
|-------|------|------|
| Bridge to dgd-core | `src/config/dgd.js`, `src/services/dgdCoreClient.js` | Bearer-authed calls to the dgd-core funds API; **`DGD_CORE_AUTH_TOKEN` stays server-side** |
| REST endpoints | `src/controllers/dgdEscrowController.js`, `src/routes/dgdEscrowRoutes.js` | `/api/dgd-escrow/:orderId/*` — open, get, check-funding, propose-release, payout-psbt, sign-payout, open-dispute |
| Order fields | `src/models/Order.js` | `dgdEscrowId`, `dgdEscrowAddress`, `dgdExpectedSats`, `dgdEscrowState` |
| Signing panel | `public/js/dgd-signing-panel.js` | Reusable, zero-dependency `DgdSigningPanel`; state-driven UI |
| Order-page wiring | `public/js/app.js` (`showDgdEscrowFlow`) | DGD orders branch to open-escrow → mount the panel |

## Flow (buyer's session)
```
order placed (cryptocurrency = DGD)
  → showDgdEscrowFlow(): collect buyer DGD pubkey + payout address
    (seller + arbitrator keys come from the seller profile / platform in production)
  → POST /api/dgd-escrow/:id/open  → escrow `created`, multisig address shown
  → DgdSigningPanel.mount() drives the rest:
       created  → buyer funds the multisig address → "Check funding"
       funded   → "Propose release" / "Open dispute"
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
});
panel.mount();
```
- Never requests a key, seed, or passphrase.
- Three PSBT transports each way: file (`.psbt`), copy/paste base64, QR.
- Polls escrow state every 6s until terminal; maps server errors to clear text.

## Auth precondition (important)
The `/api/dgd-escrow/*` routes are guarded by `protect` (Bearer JWT) — non-custodial
signing is a per-party authenticated action. The buyer/seller must be **logged in**;
the panel and the open call attach `Authorization: Bearer <token>` from
`getAuthToken()`. Without a session the routes return 401 and the UI says so.

## Not yet wired (needs product decisions / live env)
- **Seller + arbitrator key resolution** — entered in the demo form; in production
  the seller's DGD pubkey/payout come from their seller profile and the arbitrator
  from the platform's vetted list. Add those lookups server-side in `openEscrow`.
- **Live dgd-core + DGD node** — `DGD_CORE_URL` / `DGD_CORE_AUTH_TOKEN` must point at
  a running dgd-core; end-to-end fund→sign→broadcast needs a real DGD node.
- **DGD amount on the order** — `dgdExpectedSats` should be set when a DGD order is
  created (currently defaults to `'0'` if unset at open time).
