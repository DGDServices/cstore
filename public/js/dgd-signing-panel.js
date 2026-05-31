/**
 * DGD non-custodial escrow signing panel.
 *
 * Driven off escrow `state` + `proposal`. The app never handles a private key:
 * it fetches the unsigned PSBT, the user signs it in DGD-QT, and submits the
 * signed PSBT back here. See artifacts/Client_Signing_UI_Spec.md.
 *
 * Usage:
 *   const panel = new DgdSigningPanel({ orderId, role, containerId });
 *   panel.mount();
 */

/* global QRCode */ // optional: included separately if available

class DgdSigningPanel {
  constructor({ orderId, role, containerId }) {
    this.orderId     = orderId;
    this.role        = role;                 // 'buyer' | 'seller'
    this.container   = document.getElementById(containerId);
    this._idemSeq    = 0;
    this._pollTimer  = null;
    if (!this.container) throw new Error(`DgdSigningPanel: #${containerId} not found`);
  }

  // ── API calls (all via the Express server, which holds the dgd-core token) ──

  async _api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`/api/dgd-escrow/${encodeURIComponent(this.orderId)}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  getEscrow()           { return this._api('GET',  '');                                             }
  checkFunding()        { return this._api('POST', '/check-funding');                               }
  proposeRelease()      { return this._api('POST', '/propose-release', { role: this.role });        }
  openDispute(reason)   { return this._api('POST', '/open-dispute',    { role: this.role, reason }); }
  getPayoutPsbt()       { return this._api('GET',  '/payout-psbt');                                 }
  signPayout(signed)    {
    const key = `${this.orderId}:${this.role}:sign:${++this._idemSeq}`;
    return this._api('POST', '/sign-payout', { role: this.role, signedPsbt: signed, idempotencyKey: key });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  mount() { this._refresh(); }

  async _refresh() {
    try {
      const { escrow } = await this.getEscrow();
      this._render(escrow);
    } catch (e) {
      this._html(`<p class="dgd-error">Failed to load escrow: ${e.message}</p>`);
    }
  }

  _poll(escrow) {
    clearTimeout(this._pollTimer);
    const TERMINAL = ['released', 'resolved', 'refunded', 'expired'];
    if (!TERMINAL.includes(escrow.state)) {
      this._pollTimer = setTimeout(() => this._refresh(), 6000);
    }
  }

  _render(escrow) {
    this._poll(escrow);
    const state     = escrow.state;
    const proposal  = escrow.proposal;
    const threshold = escrow.policy?.threshold ?? 2;
    const signed    = proposal ? Object.keys(proposal.signatures || {}).length : 0;
    const TERMINAL  = ['released', 'resolved', 'refunded', 'expired'];

    let html = `<div class="dgd-panel">
      <div class="dgd-state-row"><span class="dgd-label">Escrow state</span>
        <span class="dgd-badge dgd-badge--${state}">${state}</span></div>`;

    if (state === 'created' && escrow.multisig) {
      html += this._renderCreated(escrow);
    } else if (state === 'funded' && !proposal) {
      html += this._renderFunded();
    } else if (proposal && !TERMINAL.includes(state)) {
      html += this._renderSigning(escrow, signed, threshold);
    } else if (state === 'disputed' && !proposal) {
      html += `<p class="dgd-info">Dispute opened — awaiting arbitrator resolution.</p>`;
    } else if (TERMINAL.includes(state)) {
      html += this._renderTerminal(escrow);
    }

    html += `</div>`;
    this._html(html);
    this._bindActions(escrow, signed, threshold);
  }

  _renderCreated(escrow) {
    return `
      <p class="dgd-info">Fund this multisig address to begin escrow settlement:</p>
      <div class="dgd-address-box">
        <code class="dgd-address">${escrow.multisig.address}</code>
        <button class="dgd-btn dgd-btn--ghost" onclick="navigator.clipboard?.writeText('${escrow.multisig.address}')">Copy address</button>
      </div>
      <p class="dgd-hint">Send exactly the agreed DGD amount. Once confirmed on-chain, press the button below.</p>
      <button class="dgd-btn" id="dgd-check-funding">Check funding</button>`;
  }

  _renderFunded() {
    return `
      <p class="dgd-info">Escrow is funded. When ready to settle, propose the release:</p>
      <div class="dgd-actions">
        <button class="dgd-btn" id="dgd-propose-release">Propose release</button>
        <button class="dgd-btn dgd-btn--danger" id="dgd-open-dispute">Open dispute</button>
      </div>`;
  }

  _renderSigning(escrow, signed, threshold) {
    const remaining = threshold - signed;
    return `
      <p class="dgd-info">Signed ${signed} of ${threshold} required. ${remaining} more signature${remaining !== 1 ? 's' : ''} needed.</p>
      <details class="dgd-instructions" open>
        <summary>How to sign in DGD-QT</summary>
        <ol>
          <li>Download (or copy) the unsigned PSBT below.</li>
          <li>Open <strong>DGD-QT</strong> → <em>Window ▸ Load PSBT</em>.</li>
          <li><strong>Verify</strong> the outputs match the agreed amounts before signing.</li>
          <li>Sign the PSBT in DGD-QT and export it.</li>
          <li>Upload or paste the signed PSBT in the box below.</li>
        </ol>
        <p class="dgd-warn">⚠️ Always verify outputs in your wallet. This app never sees your private key.</p>
      </details>
      <div id="dgd-psbt-area"></div>`;
  }

  _renderTerminal(escrow) {
    const txid = (escrow.history || []).find((h) => h.type === 'payout_broadcast')?.detail;
    const label = { released: 'Released ✓', resolved: 'Resolved ✓', refunded: 'Refunded', expired: 'Expired' };
    return `<p class="dgd-success">${label[escrow.state] || escrow.state}${txid ? ` — txid: <code>${txid}</code>` : ''}</p>`;
  }

  // ── Actions + PSBT hand-off ────────────────────────────────────────────────

  _bindActions(escrow, signed, threshold) {
    this._on('dgd-check-funding',  () => this._doCheckFunding());
    this._on('dgd-propose-release',() => this._doProposeRelease());
    this._on('dgd-open-dispute',   () => {
      const reason = prompt('Describe the dispute reason:');
      if (reason !== null) this._doOpenDispute(reason);
    });
    const area = document.getElementById('dgd-psbt-area');
    if (area && escrow.proposal && !['released','resolved','refunded','expired'].includes(escrow.state)) {
      this._renderPsbtHandoff(area);
    }
  }

  _renderPsbtHandoff(container) {
    container.innerHTML = `
      <button class="dgd-btn dgd-btn--secondary" id="dgd-fetch-psbt">Get unsigned PSBT</button>
      <div id="dgd-psbt-out" style="display:none">
        <div class="dgd-handoff-row">
          <button class="dgd-btn dgd-btn--ghost" id="dgd-dl-psbt">⬇ Download .psbt</button>
          <button class="dgd-btn dgd-btn--ghost" id="dgd-copy-psbt">📋 Copy base64</button>
        </div>
        <div id="dgd-qr-wrap"></div>
        <p class="dgd-hint">Sign in DGD-QT, then return the signed PSBT:</p>
        <textarea id="dgd-signed-psbt" class="dgd-textarea" rows="4"
          placeholder="Paste the signed PSBT (base64) here…"></textarea>
        <input type="file" id="dgd-upload-psbt" accept=".psbt,.txt,text/*" class="dgd-file-input">
        <label for="dgd-upload-psbt" class="dgd-btn dgd-btn--ghost">📂 Upload signed .psbt</label>
        <button class="dgd-btn" id="dgd-submit-psbt" disabled>Submit signed PSBT</button>
        <p id="dgd-sign-error" class="dgd-error" style="display:none"></p>
      </div>`;

    this._on('dgd-fetch-psbt',  () => this._doFetchPsbt());
    this._on('dgd-submit-psbt', () => this._doSubmit());
    this._on('dgd-upload-psbt', (e) => this._onFileUpload(e), 'change');
    const ta = document.getElementById('dgd-signed-psbt');
    if (ta) ta.addEventListener('input', () => {
      const btn = document.getElementById('dgd-submit-psbt');
      if (btn) btn.disabled = !ta.value.trim();
    });
  }

  // ── PSBT fetch + display ──────────────────────────────────────────────────

  async _doFetchPsbt() {
    try {
      const { psbt } = await this.getPayoutPsbt();
      this._psbt = psbt;
      const out = document.getElementById('dgd-psbt-out');
      if (out) out.style.display = '';

      // Download button
      this._on('dgd-dl-psbt', () => {
        const blob = new Blob([psbt], { type: 'application/octet-stream' });
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob), download: `${this.orderId}-payout.psbt`
        });
        a.click(); URL.revokeObjectURL(a.href);
      });

      // Copy button
      this._on('dgd-copy-psbt', () => navigator.clipboard?.writeText(psbt));

      // QR code (best-effort; only if QRCode lib is loaded)
      const qrWrap = document.getElementById('dgd-qr-wrap');
      if (qrWrap && typeof QRCode !== 'undefined') {
        qrWrap.innerHTML = '';
        try { new QRCode(qrWrap, { text: psbt, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.L }); }
        catch {}
      }
    } catch (e) {
      const msg = e.message.includes('no active payout proposal')
        ? 'No active proposal yet — propose release or refund first.'
        : e.message;
      this._showSignError(msg);
    }
  }

  async _doSubmit() {
    const ta  = document.getElementById('dgd-signed-psbt');
    const btn = document.getElementById('dgd-submit-psbt');
    const signed = ta?.value.trim();
    if (!signed) return;
    if (btn) btn.disabled = true;
    try {
      const { escrow } = await this.signPayout(signed);
      this._render(escrow);
    } catch (e) {
      const friendly = e.message.includes('invalid signature') || e.message.includes('does not match')
        ? 'That signed PSBT doesn\'t match this payout (wrong outputs, wrong escrow, or not signed by your key). Re-export from your wallet and try again.'
        : e.message.includes('401') ? 'Service auth error — please contact support.'
        : e.message;
      this._showSignError(friendly);
      if (btn) btn.disabled = false;
    }
  }

  _onFileUpload(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ta = document.getElementById('dgd-signed-psbt');
      if (ta) { ta.value = ev.target.result.trim(); ta.dispatchEvent(new Event('input')); }
    };
    reader.readAsText(file);
  }

  async _doCheckFunding() {
    try {
      const { escrow } = await this.checkFunding();
      this._render(escrow);
    } catch (e) { this._showStatus(e.message, 'error'); }
  }

  async _doProposeRelease() {
    try {
      const { escrow } = await this.proposeRelease();
      this._render(escrow);
    } catch (e) { this._showStatus(e.message, 'error'); }
  }

  async _doOpenDispute(reason) {
    try {
      const { escrow } = await this.openDispute(reason);
      this._render(escrow);
    } catch (e) { this._showStatus(e.message, 'error'); }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  _html(html)   { this.container.innerHTML = html; }
  _on(id, fn, ev = 'click') {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }
  _showSignError(msg) {
    const el = document.getElementById('dgd-sign-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }
  _showStatus(msg, type = 'info') {
    const el = document.createElement('p');
    el.className = `dgd-${type}`;
    el.textContent = msg;
    this.container.prepend(el);
    setTimeout(() => el.remove(), 6000);
  }
}

// ── Minimal CSS injected once ─────────────────────────────────────────────────

(function injectStyles() {
  if (document.getElementById('dgd-panel-styles')) return;
  const style = document.createElement('style');
  style.id = 'dgd-panel-styles';
  style.textContent = `
    .dgd-panel { font-family: system-ui, sans-serif; font-size: 0.9rem; border: 1px solid #ddd; border-radius: 8px; padding: 1.2rem; max-width: 560px; }
    .dgd-state-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .dgd-badge { padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
    .dgd-badge--created  { background: #fef3c7; color: #92400e; }
    .dgd-badge--funded   { background: #d1fae5; color: #065f46; }
    .dgd-badge--released,.dgd-badge--resolved { background: #a7f3d0; color: #064e3b; }
    .dgd-badge--disputed { background: #fee2e2; color: #991b1b; }
    .dgd-badge--refunded,.dgd-badge--expired { background: #f3f4f6; color: #374151; }
    .dgd-info  { color: #374151; margin: .5rem 0; }
    .dgd-hint  { color: #6b7280; font-size: 0.8rem; margin: .4rem 0; }
    .dgd-warn  { color: #92400e; background: #fef3c7; padding: 6px 10px; border-radius: 4px; margin-top: .5rem; }
    .dgd-error { color: #dc2626; }
    .dgd-success { color: #065f46; font-weight: 600; }
    .dgd-btn  { cursor: pointer; padding: 8px 16px; border-radius: 5px; border: none; background: #1d4ed8; color: #fff; font-size: .85rem; }
    .dgd-btn--secondary { background: #6b7280; }
    .dgd-btn--ghost { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .dgd-btn--danger { background: #dc2626; }
    .dgd-btn:disabled { opacity: .5; cursor: not-allowed; }
    .dgd-actions { display: flex; gap: .5rem; margin-top: .5rem; flex-wrap: wrap; }
    .dgd-handoff-row { display: flex; gap: .5rem; margin: .5rem 0; flex-wrap: wrap; }
    .dgd-address-box { background: #f3f4f6; border-radius: 4px; padding: 8px 12px; display: flex; align-items: center; gap: .5rem; margin: .5rem 0; flex-wrap: wrap; }
    .dgd-address { font-size: .75rem; word-break: break-all; }
    .dgd-textarea { width: 100%; box-sizing: border-box; font-family: monospace; font-size: .75rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 6px; margin: .4rem 0; }
    .dgd-file-input { display: none; }
    .dgd-instructions summary { cursor: pointer; font-weight: 600; }
    .dgd-instructions ol { padding-left: 1.2rem; margin: .4rem 0; }
    .dgd-instructions li { margin-bottom: .3rem; }
  `;
  document.head.appendChild(style);
}());

// Export for module usage or window global
if (typeof module !== 'undefined') module.exports = { DgdSigningPanel };
else if (typeof window !== 'undefined') window.DgdSigningPanel = DgdSigningPanel;
