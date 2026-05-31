const axios = require('axios');
const CurrencyRate = require('../models/CurrencyRate');
const logger = require('../utils/logger');

// Supported fiat currencies
const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'
];

// Currency decimal places for rounding
const CURRENCY_DECIMALS = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  default: 2
};

// API configuration (using ExchangeRate-API free tier)
const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest';
const FALLBACK_API_URL = 'https://open.er-api.com/v6/latest';

/**
 * Fetch latest exchange rates from external API
 * @param {string} base - Base currency (default: USD)
 * @returns {Promise<Object>} - Exchange rates
 */
async function fetchExchangeRates(base = 'USD') {
  try {
    const response = await axios.get(`${EXCHANGE_RATE_API_URL}/${base}`, {
      timeout: 5000
    });
    
    if (response.data && response.data.rates) {
      return response.data.rates;
    }
    
    throw new Error('Invalid API response format');
  } catch (error) {
    logger.warn(`Primary exchange rate API failed: ${error.message}. Trying fallback...`);
    
    // Try fallback API
    try {
      const fallbackResponse = await axios.get(`${FALLBACK_API_URL}/${base}`, {
        timeout: 5000
      });
      
      if (fallbackResponse.data && fallbackResponse.data.rates) {
        return fallbackResponse.data.rates;
      }
    } catch (fallbackError) {
      logger.error(`Fallback exchange rate API also failed: ${fallbackError.message}`);
    }
    
    throw new Error('Failed to fetch exchange rates from all sources');
  }
}

/**
 * Update exchange rates in database
 * @param {string} base - Base currency
 * @returns {Promise<Object>} - Update result
 */
async function updateExchangeRates(base = 'USD') {
  try {
    // Sanitize and validate the base parameter to prevent NoSQL injection
    if (typeof base !== 'string') {
      throw new Error('Base currency must be a string');
    }
    base = base.toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(base)) {
      throw new Error('Unsupported base currency');
    }

    const rates = await fetchExchangeRates(base);
    const updatedRates = [];
    
    for (const [currency, rate] of Object.entries(rates)) {
      if (SUPPORTED_CURRENCIES.includes(currency)) {
        const currencyRate = await CurrencyRate.findOneAndUpdate(
          { baseCurrency: base, targetCurrency: currency },
          {
            baseCurrency: base,
            targetCurrency: currency,
            rate,
            source: 'api',
            lastUpdated: new Date(),
            isActive: true
          },
          { upsert: true, new: true }
        );
        updatedRates.push(currencyRate);
      }
    }
    
    logger.info(`Updated ${updatedRates.length} exchange rates for base ${base}`);
    
    return {
      success: true,
      base,
      count: updatedRates.length,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error(`Error updating exchange rates: ${error.message}`);
    throw error;
  }
}

/**
 * Get exchange rate between two currencies
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @returns {Promise<number>} - Exchange rate
 */
async function getExchangeRate(from, to) {
  from = from.toUpperCase();
  to = to.toUpperCase();
  
  // Same currency
  if (from === to) {
    return 1;
  }
  
  try {
    // Try to get from database
    const rate = await CurrencyRate.getLatestRate(from, to);
    
    if (rate) {
      // Check if rate is recent (less than 24 hours old)
      const hoursSinceUpdate = (Date.now() - rate.lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        return rate.rate;
      }
    }
    
    // If rate is old or doesn't exist, fetch new rates
    logger.info(`Exchange rate for ${from}/${to} is stale or missing, fetching new rates...`);
    await updateExchangeRates(from);
    
    // Try again after update
    const updatedRate = await CurrencyRate.getLatestRate(from, to);
    if (updatedRate) {
      return updatedRate.rate;
    }
    
    throw new Error(`Exchange rate not found for ${from}/${to}`);
  } catch (error) {
    logger.error(`Error getting exchange rate: ${error.message}`);
    throw error;
  }
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @returns {Promise<Object>} - Conversion result
 */
async function convertCurrency(amount, from, to) {
  try {
    const rate = await getExchangeRate(from, to);
    const convertedAmount = amount * rate;
    const roundedAmount = roundCurrency(convertedAmount, to);
    
    return {
      originalAmount: amount,
      originalCurrency: from.toUpperCase(),
      convertedAmount: roundedAmount,
      targetCurrency: to.toUpperCase(),
      exchangeRate: rate,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error(`Error converting currency: ${error.message}`);
    throw error;
  }
}

/**
 * Round amount according to currency conventions
 * @param {number} amount - Amount to round
 * @param {string} currency - Currency code
 * @returns {number} - Rounded amount
 */
function roundCurrency(amount, currency) {
  const decimals = CURRENCY_DECIMALS[currency.toUpperCase()] ?? CURRENCY_DECIMALS.default;
  return Number(amount.toFixed(decimals));
}

/**
 * Get all supported currencies
 * @returns {Array} - List of supported currencies
 */
function getSupportedCurrencies() {
  return SUPPORTED_CURRENCIES.map(code => ({
    code,
    name: getCurrencyName(code),
    symbol: getCurrencySymbol(code),
    decimals: CURRENCY_DECIMALS[code] ?? CURRENCY_DECIMALS.default
  }));
}

/**
 * Get currency name
 * @param {string} code - Currency code
 * @returns {string} - Currency name
 */
function getCurrencyName(code) {
  const names = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    JPY: 'Japanese Yen',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    CHF: 'Swiss Franc',
    CNY: 'Chinese Yuan',
    INR: 'Indian Rupee',
    BRL: 'Brazilian Real'
  };
  return names[code] || code;
}

/**
 * Get currency symbol
 * @param {string} code - Currency code
 * @returns {string} - Currency symbol
 */
function getCurrencySymbol(code) {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
    BRL: 'R$'
  };
  return symbols[code] || code;
}

/**
 * Initialize currency rates (run on startup)
 * @returns {Promise<void>}
 */
async function initializeCurrencyRates() {
  try {
    logger.info('Initializing currency rates...');
    await updateExchangeRates('USD');
    logger.info('Currency rates initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize currency rates: ${error.message}`);
    // Don't throw - allow app to start even if rates fail
  }
}

module.exports = {
  updateExchangeRates,
  getExchangeRate,
  convertCurrency,
  roundCurrency,
  getSupportedCurrencies,
  getCurrencyName,
  getCurrencySymbol,
  initializeCurrencyRates,
  SUPPORTED_CURRENCIES
};
