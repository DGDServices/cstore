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

const BASE_CRYPTOCURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'BTC-LN', name: 'Bitcoin Lightning Network' }
];

const ALL_SUPPORTED_CRYPTOCURRENCIES = [
  ...BASE_CRYPTOCURRENCIES,
  ...DGF_CFV_COINS
];

const ALL_SUPPORTED_CRYPTO_SYMBOLS = ALL_SUPPORTED_CRYPTOCURRENCIES.map(coin => coin.symbol);
const NON_LIGHTNING_CRYPTO_SYMBOLS = ALL_SUPPORTED_CRYPTO_SYMBOLS.filter(symbol => symbol !== 'BTC-LN');

module.exports = {
  DGF_CFV_COINS,
  BASE_CRYPTOCURRENCIES,
  ALL_SUPPORTED_CRYPTOCURRENCIES,
  ALL_SUPPORTED_CRYPTO_SYMBOLS,
  NON_LIGHTNING_CRYPTO_SYMBOLS
};
