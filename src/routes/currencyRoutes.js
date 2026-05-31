const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  getSupportedCurrencies,
  getExchangeRates,
  convertCurrency,
  updateExchangeRates,
  getExchangeRateHistory,
  setManualRate
} = require('../controllers/currencyController');
const { protect, authorize } = require('../middleware/auth');

// Public routes

// Rate limiter for GET /rates (100 requests per 15 minutes per IP)
const getRatesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiter for manual rate setting (10 requests per 15 minutes per IP)
const manualRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', getSupportedCurrencies);
router.get('/rates', getRatesLimiter, getExchangeRates);
router.post('/convert', convertCurrency);

// Admin routes
router.post('/rates/update', protect, authorize('admin'), updateExchangeRates);
router.get('/rates/history', protect, authorize('admin'), getExchangeRateHistory);
router.post('/rates/manual', manualRateLimiter, protect, authorize('admin'), setManualRate);

module.exports = router;
