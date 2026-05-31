const logger = require('../utils/logger');
const currencyService = require('../services/currencyService');
const { seedRegionalPayments } = require('../utils/seedRegionalPayments');
const lightningService = require('../services/lightningService');

/**
 * Initialize application startup tasks
 */
async function initializeApp() {
  logger.info('Starting application initialization...');

  // Initialize currency rates
  try {
    await currencyService.initializeCurrencyRates();
  } catch (error) {
    logger.error(`Failed to initialize currency rates: ${error.message}`);
    // Don't fail startup - rates can be updated later
  }

  // Seed regional payment methods
  try {
    await seedRegionalPayments();
  } catch (error) {
    logger.error(`Failed to seed regional payment methods: ${error.message}`);
    // Don't fail startup - methods can be added manually
  }

  // Initialize Lightning Network
  try {
    await lightningService.initializeLightning();
  } catch (error) {
    logger.error(`Failed to initialize Lightning Network: ${error.message}`);
    // Don't fail startup - Lightning is optional
  }

  logger.info('Application initialization completed');
}

module.exports = { initializeApp };
