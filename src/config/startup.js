const logger = require('../utils/logger');
const currencyService = require('../services/currencyService');

/**
 * Initialize application startup tasks.
 * NOTE: currency-rate initialization is legacy multi-currency code and is
 * removed in the order-rewrite PR (DGD-only settlement, decision D5/C1).
 */
async function initializeApp() {
  logger.info('Starting application initialization...');

  try {
    await currencyService.initializeCurrencyRates();
  } catch (error) {
    logger.error(`Failed to initialize currency rates: ${error.message}`);
  }

  logger.info('Application initialization completed');
}

module.exports = { initializeApp };
