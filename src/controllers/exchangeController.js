const exchangeService = require('../services/exchangeService');
const riskService = require('../services/riskService');
const logger = require('../utils/logger');

/**
 * Exchange Controller
 * Handles HTTP requests for exchange operations
 */

/**
 * Get exchange rates
 * GET /api/exchanges/rates
 */
exports.getExchangeRates = async (req, res) => {
  try {
    const { cryptocurrency, fiatCurrency, exchange } = req.query;

    if (!cryptocurrency || !fiatCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Cryptocurrency and fiat currency are required'
      });
    }

    let rates;
    if (exchange) {
      // Get rate from specific exchange
      const rate = await exchangeService.getExchangeRate(
        exchange,
        cryptocurrency.toUpperCase(),
        fiatCurrency.toUpperCase()
      );
      rates = [{
        exchange,
        rate,
        timestamp: new Date()
      }];
    } else {
      // Get rates from all exchanges
      rates = await exchangeService.getAllExchangeRates(
        cryptocurrency.toUpperCase(),
        fiatCurrency.toUpperCase()
      );
    }

    res.status(200).json({
      success: true,
      data: {
        cryptocurrency: cryptocurrency.toUpperCase(),
        fiatCurrency: fiatCurrency.toUpperCase(),
        rates
      }
    });
  } catch (error) {
    logger.error('Failed to get exchange rates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get best exchange rate
 * GET /api/exchanges/best-rate
 */
exports.getBestRate = async (req, res) => {
  try {
    const { cryptocurrency, fiatCurrency } = req.query;

    if (!cryptocurrency || !fiatCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Cryptocurrency and fiat currency are required'
      });
    }

    const bestRate = await exchangeService.getBestExchangeRate(
      cryptocurrency.toUpperCase(),
      fiatCurrency.toUpperCase()
    );

    res.status(200).json({
      success: true,
      data: bestRate
    });
  } catch (error) {
    logger.error('Failed to get best rate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get exchange balances
 * GET /api/exchanges/balances
 */
exports.getExchangeBalances = async (req, res) => {
  try {
    const { exchange, currency } = req.query;

    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view exchange balances'
      });
    }

    let balances;
    if (exchange && currency) {
      // Get specific balance
      const balance = await exchangeService.getBalance(exchange, currency.toUpperCase());
      balances = balance ? [balance] : [];
    } else if (exchange) {
      // Get all balances for exchange
      const ExchangeBalance = require('../models/ExchangeBalance');
      balances = await ExchangeBalance.getExchangeBalances(exchange);
    } else {
      // Get all balances
      const ExchangeBalance = require('../models/ExchangeBalance');
      balances = await ExchangeBalance.find({}).sort({ exchange: 1, currency: 1 });
    }

    res.status(200).json({
      success: true,
      data: balances
    });
  } catch (error) {
    logger.error('Failed to get exchange balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Sync exchange balances
 * POST /api/exchanges/sync-balances
 */
exports.syncBalances = async (req, res) => {
  try {
    const { exchange } = req.body;

    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can sync balances'
      });
    }

    let results;
    if (exchange) {
      results = await exchangeService.syncExchangeBalances(exchange);
    } else {
      results = await exchangeService.syncAllBalances();
    }

    res.status(200).json({
      success: true,
      message: 'Balances synced successfully',
      data: results
    });
  } catch (error) {
    logger.error('Failed to sync balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test exchange connection
 * POST /api/exchanges/test-connection
 */
exports.testConnection = async (req, res) => {
  try {
    const { exchange } = req.body;

    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can test exchange connections'
      });
    }

    if (!exchange) {
      return res.status(400).json({
        success: false,
        error: 'Exchange name is required'
      });
    }

    const result = await exchangeService.testConnection(exchange);

    res.status(200).json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get low balance alerts
 * GET /api/exchanges/low-balance-alerts
 */
exports.getLowBalanceAlerts = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view balance alerts'
      });
    }

    const alerts = await exchangeService.getLowBalanceAlerts();

    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Failed to get low balance alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get available exchanges
 * GET /api/exchanges/available
 */
exports.getAvailableExchanges = async (req, res) => {
  try {
    const exchanges = exchangeService.getAvailableExchanges();

    res.status(200).json({
      success: true,
      data: exchanges
    });
  } catch (error) {
    logger.error('Failed to get available exchanges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get exchange reliability stats
 * GET /api/exchanges/reliability
 */
exports.getExchangeReliability = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view reliability stats'
      });
    }

    const reliability = await riskService.monitorExchangeReliability();

    res.status(200).json({
      success: true,
      data: reliability
    });
  } catch (error) {
    logger.error('Failed to get exchange reliability:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Clear rate cache
 * POST /api/exchanges/clear-cache
 */
exports.clearCache = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can clear cache'
      });
    }

    exchangeService.clearRateCache();

    res.status(200).json({
      success: true,
      message: 'Rate cache cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
