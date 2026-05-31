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
