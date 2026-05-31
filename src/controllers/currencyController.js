const { asyncHandler, AppError } = require('../middleware/errorHandler');
const currencyService = require('../services/currencyService');
const CurrencyRate = require('../models/CurrencyRate');

// @desc    Get all supported currencies
// @route   GET /api/currencies
// @access  Public
const getSupportedCurrencies = asyncHandler(async (req, res, next) => {
  const currencies = currencyService.getSupportedCurrencies();
  
  res.json({
    success: true,
    data: { currencies }
  });
});

// @desc    Get current exchange rates
// @route   GET /api/currencies/rates
// @access  Public
const getExchangeRates = asyncHandler(async (req, res, next) => {
  const { base = 'USD' } = req.query;
  
  const rates = await CurrencyRate.find({
    baseCurrency: base.toUpperCase(),
    isActive: true
  }).sort('-lastUpdated');
  
  // Get unique latest rates
  const latestRates = {};
  rates.forEach(rate => {
    if (!latestRates[rate.targetCurrency]) {
      latestRates[rate.targetCurrency] = {
        currency: rate.targetCurrency,
        rate: rate.rate,
        lastUpdated: rate.lastUpdated
      };
    }
  });
  
  res.json({
    success: true,
    data: {
      base: base.toUpperCase(),
      rates: Object.values(latestRates),
      timestamp: new Date()
    }
  });
});

// @desc    Convert currency
// @route   POST /api/currencies/convert
// @access  Public
const convertCurrency = asyncHandler(async (req, res, next) => {
  const { amount, from, to } = req.body;
  
  if (!amount || !from || !to) {
    return next(new AppError('Please provide amount, from, and to currencies', 400));
  }
  
  if (isNaN(amount) || amount <= 0) {
    return next(new AppError('Amount must be a positive number', 400));
  }
  
  const result = await currencyService.convertCurrency(amount, from, to);
  
  res.json({
    success: true,
    data: result
  });
});

// @desc    Update exchange rates (admin only)
// @route   POST /api/currencies/rates/update
// @access  Private/Admin
const updateExchangeRates = asyncHandler(async (req, res, next) => {
  const { base = 'USD' } = req.body;

  // Validate base currency
  const upperBase = typeof base === 'string' ? base.toUpperCase() : '';
  const SUPPORTED_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'
  ];
  if (!SUPPORTED_CURRENCIES.includes(upperBase)) {
    return next(new AppError('Invalid base currency provided', 400));
  }

  const result = await currencyService.updateExchangeRates(upperBase);

  res.json({
    success: true,
    message: req.t('message.ratesUpdated'),
    data: result
  });
});

// @desc    Get exchange rate history
// @route   GET /api/currencies/rates/history
// @access  Private/Admin
const getExchangeRateHistory = asyncHandler(async (req, res, next) => {
  const { from, to, days = 30 } = req.query;
  
  if (!from || !to) {
    return next(new AppError('Please provide from and to currencies', 400));
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  
  const history = await CurrencyRate.find({
    baseCurrency: from.toUpperCase(),
    targetCurrency: to.toUpperCase(),
    createdAt: { $gte: startDate }
  }).sort('createdAt');
  
  res.json({
    success: true,
    data: {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      period: `${days} days`,
      history: history.map(h => ({
        rate: h.rate,
        date: h.createdAt,
        source: h.source
      }))
    }
  });
});

// @desc    Set manual exchange rate (admin only)
// @route   POST /api/currencies/rates/manual
// @access  Private/Admin
const setManualRate = asyncHandler(async (req, res, next) => {
  const { from, to, rate } = req.body;
  
  if (!from || !to || !rate) {
    return next(new AppError('Please provide from, to, and rate', 400));
  }
  
  if (isNaN(rate) || rate <= 0) {
    return next(new AppError('Rate must be a positive number', 400));
  }
  
  const currencyRate = await CurrencyRate.create({
    baseCurrency: from.toUpperCase(),
    targetCurrency: to.toUpperCase(),
    rate: parseFloat(rate),
    source: 'manual',
    lastUpdated: new Date(),
    isActive: true
  });
  
  res.status(201).json({
    success: true,
    message: req.t('message.rateSet'),
    data: { rate: currencyRate }
  });
});

module.exports = {
  getSupportedCurrencies,
  getExchangeRates,
  convertCurrency,
  updateExchangeRates,
  getExchangeRateHistory,
  setManualRate
};
