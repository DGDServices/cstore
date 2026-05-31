const { asyncHandler, AppError } = require('../middleware/errorHandler');
const RegionalPaymentMethod = require('../models/RegionalPaymentMethod');

// @desc    Get payment methods for a region
// @route   GET /api/payments/regional
// @access  Public
const getRegionalPaymentMethods = asyncHandler(async (req, res, next) => {
  const { country, region, currency } = req.query;
  
  let query = { isActive: true };
  
  // Build query based on filters
  if (country) {
    query.countries = country.toUpperCase();
  }
  
  if (region) {
    query.regions = region.toUpperCase();
  }
  
  if (currency) {
    query.currencies = currency.toUpperCase();
  }
  
  const paymentMethods = await RegionalPaymentMethod.find(query);
  
  res.json({
    success: true,
    data: {
      paymentMethods,
      filters: { country, region, currency }
    }
  });
});

// @desc    Get all payment methods (admin)
// @route   GET /api/payments/regional/all
// @access  Private/Admin
const getAllPaymentMethods = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  
  const skip = (page - 1) * limit;
  const paymentMethods = await RegionalPaymentMethod.find()
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));
  
  const total = await RegionalPaymentMethod.countDocuments();
  
  res.json({
    success: true,
    data: {
      paymentMethods,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Create payment method (admin)
// @route   POST /api/payments/regional
// @access  Private/Admin
const createPaymentMethod = asyncHandler(async (req, res, next) => {
  const {
    name,
    code,
    description,
    regions,
    countries,
    currencies,
    type,
    processingTime,
    fees,
    provider,
    metadata
  } = req.body;
  
  if (!name || !code) {
    return next(new AppError('Please provide name and code', 400));
  }
  
  const paymentMethod = await RegionalPaymentMethod.create({
    name,
    code: code.toUpperCase(),
    description,
    regions: regions?.map(r => r.toUpperCase()),
    countries: countries?.map(c => c.toUpperCase()),
    currencies: currencies?.map(c => c.toUpperCase()),
    type,
    processingTime,
    fees,
    provider,
    metadata
  });
  
  res.status(201).json({
    success: true,
    message: req.t('message.paymentMethodCreated'),
    data: { paymentMethod }
  });
});

// @desc    Update payment method (admin)
// @route   PUT /api/payments/regional/:id
// @access  Private/Admin
const updatePaymentMethod = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const paymentMethod = await RegionalPaymentMethod.findById(id);
  
  if (!paymentMethod) {
    return next(new AppError('Payment method not found', 404));
  }
  
  // Update fields
  const updates = { ...req.body };
  
  // Normalize arrays to uppercase
  if (updates.regions) {
    updates.regions = updates.regions.map(r => r.toUpperCase());
  }
  if (updates.countries) {
    updates.countries = updates.countries.map(c => c.toUpperCase());
  }
  if (updates.currencies) {
    updates.currencies = updates.currencies.map(c => c.toUpperCase());
  }
  if (updates.code) {
    updates.code = updates.code.toUpperCase();
  }
  
  Object.assign(paymentMethod, updates);
  await paymentMethod.save();
  
  res.json({
    success: true,
    message: req.t('message.paymentMethodUpdated'),
    data: { paymentMethod }
  });
});

// @desc    Delete payment method (admin)
// @route   DELETE /api/payments/regional/:id
// @access  Private/Admin
const deletePaymentMethod = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const paymentMethod = await RegionalPaymentMethod.findById(id);
  
  if (!paymentMethod) {
    return next(new AppError('Payment method not found', 404));
  }
  
  await paymentMethod.deleteOne();
  
  res.json({
    success: true,
    message: req.t('message.paymentMethodDeleted')
  });
});

// @desc    Get payment method by code
// @route   GET /api/payments/regional/code/:code
// @access  Public
const getPaymentMethodByCode = asyncHandler(async (req, res, next) => {
  const { code } = req.params;
  
  const paymentMethod = await RegionalPaymentMethod.findOne({
    code: code.toUpperCase(),
    isActive: true
  });
  
  if (!paymentMethod) {
    return next(new AppError('Payment method not found', 404));
  }
  
  res.json({
    success: true,
    data: { paymentMethod }
  });
});

module.exports = {
  getRegionalPaymentMethods,
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethodByCode
};
