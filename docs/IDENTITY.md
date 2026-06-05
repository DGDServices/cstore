# Project Identity — Decision Record

**Decision (2026-06-05):** This project is **DGD Marketplace**, developed by **DGDServices**.

## Context

The repository (`cstore`) began as a single "Initial commit: cstore (DGD Marketplace
shell)" that imported a large, pre-existing **Cryptons.com** cryptocurrency
e-commerce / P2P platform codebase (~36k LOC). All subsequent development has been the
**non-custodial DGD escrow** graft: orders settle through a party-owned multisig on the
DGD platform, and the marketplace holds no key.

Documentation was inconsistent — branded "Cryptons.com" in the README and
`package.json`, but "DGD Marketplace shell" in git — and reported conflicting
production-readiness figures (45% vs 65%). This record resolves both.

## What changed (canonical identity surfaces)

- `package.json` / `package-lock.json` — `name` → `dgd-marketplace`; description and
  author updated.
- `README.md` — retitled **DGD Marketplace**; added this identity statement; set the
  single reconciled readiness figure (**~50%**, June 2026) with a category breakdown
  that supersedes both 45% and 65%.
- `CHANGELOG.md` — header attributes changes to DGD Marketplace.
- `AUDIT_SUMMARY.md` — banner marks it a superseded v2.1.0 (Oct 2024) snapshot.

## What was intentionally NOT renamed (and why)

The following retain the `cryptons` token deliberately. They are **internal, not
user-facing**, and renaming them would break operational contracts for no benefit:

| Identifier | Where | Risk if renamed |
|---|---|---|
| Log service names `cryptons-api`, `cryptons-audit`, `cryptons-security` | `src/utils/logger.js`, `src/utils/auditLogger.js`, `src/services/logging.js` | Breaks log queries / dashboards / alert rules keyed on these |
| Vault secret paths `cryptons/database`, `cryptons/jwt`, … | `src/services/secretsManager.js` | Breaks the contract with the configured secret store |
| Cache key prefix `cryptons:` | `src/services/cache.js` | Orphans existing cache entries |
| Elasticsearch log index `cryptons-logs` | `src/services/logging.js` | Splits log history across indices |
| Default DB name `cryptons` | `src/config/database.js` | Cosmetic; overridden by `MONGODB_URI` in every real env |

## User-facing brand strings driven by env vars (set per deployment)

Legal/content defaults still fall back to `Cryptons.com`. The correct fix is to set the
environment variables, **not** to hardcode a new brand in service code:

- `PLATFORM_LEGAL_NAME` — used by `authorityReportingService.js` and legal-document
  templates (`legalDocuments.js`).
- `DATA_CONTROLLER_EMAIL`, privacy/legal contact emails — used by `gdpr.js`,
  `legalDocuments.js`.

Set these in each environment's `.env` to the real DGD Marketplace legal entity and
contacts before any non-development use.
