const Seller = require('../models/Seller');
const SellerProduct = require('../models/SellerProduct');
const CommissionRule = require('../models/CommissionRule');
const sellerService = require('../services/sellerService');
const buyBoxService = require('../services/buyBoxService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

exports.registerSeller = async (req, res, next) => {
  try {
    const seller = await sellerService.createSellerAccount(req.user.id, req.body);
    res.status(201).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.getMySellerAccount = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ user: req.user.id }).populate('user', 'name email');
    if (!seller) return next(new AppError('Seller account not found', 404));
    res.status(200).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.updateSellerProfile = async (req, res, next) => {
  try {
    const existing = await Seller.findOne({ user: req.user.id });
    if (!existing) return next(new AppError('Seller account not found', 404));

    const seller = await sellerService.updateSellerProfile(existing._id, req.user.id, req.body);
    res.status(200).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.submitVerification = async (req, res, next) => {
  try {
    const existing = await Seller.findOne({ user: req.user.id });
    if (!existing) return next(new AppError('Seller account not found', 404));

    const seller = await sellerService.submitVerification(existing._id, req.body);
    res.status(200).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.getSellerStorefront = async (req, res, next) => {
  try {
    const data = await sellerService.getSellerStorefront(req.params.slug);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getProductOffers = async (req, res, next) => {
  try {
    const offers = await buyBoxService.getProductOffers(req.params.productId);
    res.status(200).json({ success: true, count: offers.length, data: offers });
  } catch (err) {
    next(err);
  }
};

exports.addSellerProduct = async (req, res, next) => {
  try {
    const sellerId = await _getSellerIdForUser(req.user.id, next);
    if (!sellerId) return;

    const sellerProduct = await SellerProduct.create({ ...req.body, seller: sellerId });
    await buyBoxService.recalculateOnPriceChange(sellerProduct._id);

    res.status(201).json({ success: true, data: sellerProduct });
  } catch (err) {
    next(err);
  }
};

exports.updateSellerProduct = async (req, res, next) => {
  try {
    const sellerId = await _getSellerIdForUser(req.user.id, next);
    if (!sellerId) return;

    const sellerProduct = await SellerProduct.findOne({ _id: req.params.id, seller: sellerId });
    if (!sellerProduct) return next(new AppError('Product listing not found', 404));

    const allowed = [
      'sellerSku', 'price', 'priceUSD', 'currency', 'stock', 'condition',
      'conditionNotes', 'fulfillmentType', 'isActive', 'shippingOptions',
      'handlingTime', 'images', 'notes'
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) sellerProduct[key] = req.body[key];
    }
    await sellerProduct.save();
    await buyBoxService.recalculateOnPriceChange(sellerProduct._id);

    res.status(200).json({ success: true, data: sellerProduct });
  } catch (err) {
    next(err);
  }
};

exports.removeSellerProduct = async (req, res, next) => {
  try {
    const sellerId = await _getSellerIdForUser(req.user.id, next);
    if (!sellerId) return;

    const sellerProduct = await SellerProduct.findOne({ _id: req.params.id, seller: sellerId });
    if (!sellerProduct) return next(new AppError('Product listing not found', 404));

    sellerProduct.isActive = false;
    await sellerProduct.save();
    await buyBoxService.recalculateOnPriceChange(sellerProduct._id);

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

exports.getMyProducts = async (req, res, next) => {
  try {
    const sellerId = await _getSellerIdForUser(req.user.id, next);
    if (!sellerId) return;

    const products = await SellerProduct.find({ seller: sellerId }).populate('product');
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (err) {
    next(err);
  }
};

// Admin routes

exports.getPendingVerifications = async (req, res, next) => {
  try {
    const sellers = await sellerService.getPendingVerifications();
    res.status(200).json({ success: true, count: sellers.length, data: sellers });
  } catch (err) {
    next(err);
  }
};

exports.approveVerification = async (req, res, next) => {
  try {
    const { kycLevel } = req.body;
    const seller = await sellerService.approveVerification(req.params.id, req.user.id, kycLevel);
    res.status(200).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.issueViolation = async (req, res, next) => {
  try {
    const { type, description, severity } = req.body;
    const seller = await sellerService.issueViolation(
      req.params.id,
      { type, description, severity },
      req.user.id
    );
    res.status(200).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
};

exports.getCommissionRules = async (req, res, next) => {
  try {
    const rules = await CommissionRule.find().sort({ priority: -1 });
    res.status(200).json({ success: true, count: rules.length, data: rules });
  } catch (err) {
    next(err);
  }
};

exports.createCommissionRule = async (req, res, next) => {
  try {
    const allowed = [
      'name', 'description', 'applicableTo', 'categoryIds', 'sellerTier',
      'commissionType', 'commissionPct', 'flatFee', 'tiers', 'minFee', 'maxFee',
      'isActive', 'priority'
    ];
    const data = { createdBy: req.user.id };
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const rule = await CommissionRule.create(data);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

exports.updateCommissionRule = async (req, res, next) => {
  try {
    const allowed = [
      'name', 'description', 'applicableTo', 'categoryIds', 'sellerTier',
      'commissionType', 'commissionPct', 'flatFee', 'tiers', 'minFee', 'maxFee',
      'isActive', 'priority'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const rule = await CommissionRule.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!rule) return next(new AppError('Commission rule not found', 404));
    res.status(200).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

// Helper: resolve seller _id from user id
async function _getSellerIdForUser(userId, next) {
  const seller = await Seller.findOne({ user: userId });
  if (!seller) {
    next(new AppError('Seller account not found', 404));
    return null;
  }
  return seller._id;
}
