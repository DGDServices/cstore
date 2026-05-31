'use strict';
/**
 * dgdCoreClient — the cstore (CommonJS) bridge to the dgd-core service.
 *
 * One place that knows how to talk to dgd-core for price and escrow.
 * Amounts are integer base-unit (sats) strings on the wire (JSON has no bigint);
 * pass numbers/strings/BigInt in, you get strings back.
 *
 * Requires Node 18+ (global fetch). Inject `fetchImpl` in tests.
 */

class DgdCoreError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'DgdCoreError';
    this.status = status;
  }
}

class DgdCoreClient {
  constructor(opts = {}) {
    const { DGD_CORE_URL, DGD_CORE_AUTH_TOKEN } = require('../config/dgd');
    this.baseUrl = (opts.baseUrl || DGD_CORE_URL).replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl || fetch;
    this.timeoutMs = opts.timeoutMs || 15000;
    // Bearer token for the dgd-core funds API (required in prod; see dgd-core/auth.ts).
    this.authToken = opts.authToken || DGD_CORE_AUTH_TOKEN || undefined;
  }

  async _req(method, path, body, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const headers = { 'content-type': 'application/json' };
    if (this.authToken) headers.authorization = `Bearer ${this.authToken}`;
    // Replay guard: a retried mutation with the same key is de-duplicated server-side.
    if (opts && opts.idempotencyKey) headers['idempotency-key'] = String(opts.idempotencyKey);
    let res;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new DgdCoreError(`dgd-core transport error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new DgdCoreError(payload.error || `HTTP ${res.status}`, res.status);
    return payload;
  }

  // ── price ──────────────────────────────────────────────────────────────
  getPrice() {
    return this._req('GET', '/price');
  }
  usdToSats(usd) {
    return this._req('GET', `/price/usd-to-sats?usd=${encodeURIComponent(usd)}`);
  }

  // ── escrow (the only funds path — platform never holds user funds) ─────────
  openEscrow(params) {
    return this._req('POST', '/escrow', stringifyAmounts(params));
  }
  getEscrow(orderId) {
    return this._req('GET', `/escrow/${encodeURIComponent(orderId)}`);
  }
  checkFunding(orderId, minConf) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/check-funding`, { minConf });
  }
  /**
   * Fetch the unsigned payout PSBT for the active proposal -> { psbt }.
   * The party signs this in their OWN wallet (external, e.g. DGD-QT) and submits
   * the signed PSBT via signPayout — the platform never holds a key.
   */
  getPayoutPsbt(orderId) {
    return this._req('GET', `/escrow/${encodeURIComponent(orderId)}/payout-psbt`);
  }
  // The mutating escrow calls accept an optional `idempotencyKey` so a retried
  // request (timeout/network blip) is de-duplicated by dgd-core rather than
  // re-running the action. Pass a stable key per logical operation.
  proposeRelease(orderId, by, outputs, idempotencyKey) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/release`, { by, outputs: outputs && outputs.map(stringifyOutput) }, { idempotencyKey });
  }
  openDispute(orderId, by, reason, idempotencyKey) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/dispute`, { by, reason }, { idempotencyKey });
  }
  proposeMediation(orderId, outputs, note, idempotencyKey) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/mediate`, { outputs: outputs.map(stringifyOutput), note }, { idempotencyKey });
  }
  proposeRefund(orderId, by, idempotencyKey) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/refund`, { by }, { idempotencyKey });
  }
  signPayout(orderId, role, signature, idempotencyKey) {
    return this._req('POST', `/escrow/${encodeURIComponent(orderId)}/sign`, { role, signature }, { idempotencyKey });
  }
}

function stringifyAmounts(p) {
  const out = Object.assign({}, p);
  for (const k of [
    'amountSats',
    'buyerDepositSats',
    'sellerDepositSats',
    'platformFeeSats',
    'networkFeeReserveSats',
  ]) {
    if (out[k] != null) out[k] = String(out[k]);
  }
  return out;
}
function stringifyOutput(o) {
  return { address: o.address, amount: String(o.amount) };
}

module.exports = { DgdCoreClient, DgdCoreError };
