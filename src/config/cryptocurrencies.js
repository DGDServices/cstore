/**
 * Coin lists for the DGD Marketplace.
 *
 * Settlement is DGD only (see src/config/dgd.js and docs/DGD_ESCROW_SIGNING.md).
 * DGF_CFV_COINS is the set of Digital Gold Foundation coins the CFV metrics
 * endpoints report on; it is informational and has nothing to do with what
 * the marketplace accepts as payment.
 */
const DGF_CFV_COINS = [
  { symbol: 'DGB', name: 'DigiByte' },
  { symbol: 'DASH', name: 'Dash' },
  { symbol: 'XMR', name: 'Monero' },
  { symbol: 'XNO', name: 'Nano' },
  { symbol: 'ZCL', name: 'Zclassic' },
  { symbol: 'RVN', name: 'Ravencoin' },
  { symbol: 'XEC', name: 'eCash' },
  { symbol: 'EGLD', name: 'MultiversX' },
  { symbol: 'NEAR', name: 'NEAR Protocol' },
  { symbol: 'ICP', name: 'Internet Computer' },
  { symbol: 'XCH', name: 'Chia' },
  { symbol: 'DGD', name: 'Digital Gold' }
];

/** The one and only settlement asset. */
const SETTLEMENT_CURRENCIES = [{ symbol: 'DGD', name: 'Digital Gold' }];
const SETTLEMENT_CURRENCY_SYMBOLS = SETTLEMENT_CURRENCIES.map(coin => coin.symbol);

module.exports = {
  DGF_CFV_COINS,
  SETTLEMENT_CURRENCIES,
  SETTLEMENT_CURRENCY_SYMBOLS
};
