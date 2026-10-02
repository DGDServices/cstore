# Examples

Small, runnable examples for integrating with the DGD Marketplace API.

| File | What it shows |
|---|---|
| `authenticatedUserLimiter-usage.js` | Using the per-user (JWT-keyed) rate limiter |
| `elasticsearch-usage.md` | Product search queries against the Elasticsearch index |
| `webhook-signature-example.js` | Verifying signed webhooks with the generic `webhookAuth` middleware |

For the DGD escrow flow (open → fund → propose → sign → release) see
[`docs/DGD_ESCROW_SIGNING.md`](../docs/DGD_ESCROW_SIGNING.md) and the signing panel in
`public/js/dgd-signing-panel.js`.

The Lightning Network examples that used to live here were removed with the legacy
multi-coin code in October 2026 (decision D5).
