'use strict';
/**
 * DGD configuration for the (CommonJS) cstore Marketplace.
 * Drop-in replacement mindset for the multi-coin config: settlement is DGD only.
 */
module.exports = {
  DGD: { symbol: 'DGD', name: 'Digital Gold', decimals: 8 },
  DGD_CORE_URL: process.env.DGD_CORE_URL || 'http://127.0.0.1:3200',
  DGD_CORE_AUTH_TOKEN: process.env.DGD_CORE_AUTH_TOKEN || undefined,
  DGD_CONFIRMATIONS: Number(process.env.DGD_CONFIRMATIONS || 1),
  SETTLEMENT_ASSET: 'DGD',

  // Independent arbitrator key → escrows open 2-of-3 (mediatable on dispute).
  // Unset → 2-of-2 (no dispute path; cancel-refund only).
  DGD_ARBITRATOR_PUBKEY: process.env.DGD_ARBITRATOR_PUBKEY || undefined,
  DGD_ARBITRATOR_PAYOUT_ADDRESS: process.env.DGD_ARBITRATOR_PAYOUT_ADDRESS || undefined,

  /** Convert a decimal-coin amount (number|string) to an integer-sats string (8dp). */
  toSats(decimalAmount) {
    const [whole, frac = ''] = String(decimalAmount).split('.');
    const fracPadded = (frac + '00000000').slice(0, 8);
    const sats = BigInt(whole || '0') * 100000000n + BigInt(fracPadded || '0');
    return sats.toString();
  },

  /**
   * Thesis guard (white paper section 9): refuse any non-DGD settlement so the
   * crypto->fiat conversion path can never silently re-enable.
   */
  assertSettlementIsDgd(asset) {
    if (asset !== 'DGD') {
      throw new Error(
        'DGD Marketplace settles in DGD only (auto crypto->fiat conversion is disabled).',
      );
    }
  },
};
