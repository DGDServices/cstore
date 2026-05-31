const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { protect } = require('../middleware/auth');

/**
 * Exchange Routes
 * Handles routing for exchange operations
 */

// Public routes (require authentication)
router.get(
  '/rates',
  protect,
  exchangeController.getExchangeRates
);

router.get(
  '/best-rate',
  protect,
  exchangeController.getBestRate
);

router.get(
  '/available',
  protect,
  exchangeController.getAvailableExchanges
);

// Admin routes (require admin privileges)
router.get(
  '/balances',
  protect,
  exchangeController.getExchangeBalances
);

router.post(
  '/sync-balances',
  protect,
  exchangeController.syncBalances
);

router.post(
  '/test-connection',
  protect,
  exchangeController.testConnection
);

router.get(
  '/low-balance-alerts',
  protect,
  exchangeController.getLowBalanceAlerts
);

router.get(
  '/reliability',
  protect,
  exchangeController.getExchangeReliability
);

router.post(
  '/clear-cache',
  protect,
  exchangeController.clearCache
);

module.exports = router;
