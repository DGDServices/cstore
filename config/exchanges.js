/**
 * Exchange Configuration
 * Configuration for cryptocurrency exchange integrations
 */

module.exports = {
  // Coinbase Advanced Trade API Configuration
  coinbase: {
    name: 'Coinbase',
    enabled: process.env.COINBASE_ENABLED === 'true',
    apiKey: process.env.COINBASE_API_KEY,
    apiSecret: process.env.COINBASE_API_SECRET,
    baseURL: 'https://api.coinbase.com/api/v3',
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'LTC'],
    supportedFiatCurrencies: ['USD', 'EUR', 'GBP'],
    defaultFiatCurrency: 'USD',
    fees: {
      takerFee: 0.006, // 0.6%
      makerFee: 0.004, // 0.4%
      withdrawalFee: 0.001 // 0.1%
    },
    limits: {
      minConversion: 10,
      maxConversion: 50000,
      dailyLimit: 100000
    },
    rateLimit: {
      requestsPerSecond: 10,
      burstSize: 30
    }
  },

  // Kraken API Configuration
  kraken: {
    name: 'Kraken',
    enabled: process.env.KRAKEN_ENABLED === 'true',
    apiKey: process.env.KRAKEN_API_KEY,
    apiSecret: process.env.KRAKEN_API_SECRET,
    baseURL: 'https://api.kraken.com',
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'LTC', 'XRP'],
    supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
    defaultFiatCurrency: 'USD',
    fees: {
      takerFee: 0.0026, // 0.26%
      makerFee: 0.0016, // 0.16%
      withdrawalFee: 0.0009 // 0.09%
    },
    limits: {
      minConversion: 10,
      maxConversion: 100000,
      dailyLimit: 250000
    },
    rateLimit: {
      requestsPerSecond: 15,
      burstSize: 30
    }
  },

  // Binance API Configuration
  binance: {
    name: 'Binance',
    enabled: process.env.BINANCE_ENABLED === 'true',
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    baseURL: 'https://api.binance.com',
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'LTC'],
    supportedFiatCurrencies: ['USD', 'EUR', 'GBP'],
    defaultFiatCurrency: 'USD',
    fees: {
      takerFee: 0.001, // 0.1%
      makerFee: 0.001, // 0.1%
      withdrawalFee: 0.0005 // 0.05%
    },
    limits: {
      minConversion: 10,
      maxConversion: 200000,
      dailyLimit: 500000
    },
    rateLimit: {
      requestsPerSecond: 20,
      burstSize: 50
    }
  },

  // Manual conversion configuration (for testing or manual operations)
  manual: {
    name: 'Manual',
    enabled: true,
    supportedCryptocurrencies: ['BTC', 'ETH', 'USDT', 'LTC', 'XRP'],
    supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    defaultFiatCurrency: 'USD',
    fees: {
      takerFee: 0.005,
      makerFee: 0.005,
      withdrawalFee: 0.001
    }
  },

  // Priority order for exchange selection
  exchangePriority: ['coinbase', 'kraken', 'binance'],

  // General settings
  settings: {
    // Auto-select best exchange based on rates and availability
    autoSelectExchange: true,
    
    // Retry configuration
    maxRetries: 3,
    retryDelay: 5000, // milliseconds
    
    // Rate refresh interval
    rateRefreshInterval: 60000, // 1 minute
    
    // Balance sync interval
    balanceSyncInterval: 300000, // 5 minutes
    
    // Slippage tolerance (percentage)
    maxSlippage: 2,
    
    // Timeout for API requests
    apiTimeout: 30000, // 30 seconds
    
    // Enable rate caching
    enableRateCache: true,
    rateCacheDuration: 60000 // 1 minute
  }
};
