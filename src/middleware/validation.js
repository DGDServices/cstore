const Joi = require('joi');
const { AppError } = require('./errorHandler');
const { ALL_SUPPORTED_CRYPTO_SYMBOLS, NON_LIGHTNING_CRYPTO_SYMBOLS } = require('../config/cryptocurrencies');

// Validate request body
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  // User registration
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Create order
  createOrder: Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    customerEmail: Joi.string().email().required(),
    cryptocurrency: Joi.string().valid(...ALL_SUPPORTED_CRYPTO_SYMBOLS).required(),
    shippingAddress: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      postalCode: Joi.string(),
      country: Joi.string()
    }).optional()
  }),

  // Confirm payment
  confirmPayment: Joi.object({
    orderId: Joi.string().required(),
    transactionHash: Joi.string().min(10).required()
  }),

  // Create product (admin)
  createProduct: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    price: Joi.number().min(0).required(),
    priceUSD: Joi.number().min(0).required(),
    currency: Joi.string().valid(...NON_LIGHTNING_CRYPTO_SYMBOLS).default('BTC'),
    category: Joi.string().optional(),
    stock: Joi.number().integer().min(0).default(0),
    image: Joi.string().optional()
  }),

  // Update product (admin)
  updateProduct: Joi.object({
    name: Joi.string().min(3).max(200).optional(),
    description: Joi.string().min(10).max(2000).optional(),
    price: Joi.number().min(0).optional(),
    priceUSD: Joi.number().min(0).optional(),
    currency: Joi.string().valid(...NON_LIGHTNING_CRYPTO_SYMBOLS).optional(),
    category: Joi.string().optional(),
    stock: Joi.number().integer().min(0).optional(),
    image: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  }),

  // Create/Update review
  review: Joi.object({
    productId: Joi.string().optional(),
    orderId: Joi.string().optional(),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().max(100).optional().allow(''),
    comment: Joi.string().min(10).max(1000).required()
  }),

  // Create category
  createCategory: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(500).optional().allow(''),
    image: Joi.string().optional().allow(''),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  // Update category
  updateCategory: Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    description: Joi.string().max(500).optional().allow(''),
    image: Joi.string().optional().allow(''),
    isActive: Joi.boolean().optional(),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  // Cart item
  cartItem: Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required()
  }),

  // Update cart item quantity
  updateCartItem: Joi.object({
    quantity: Joi.number().integer().min(0).required()
  }),

  // Multi-sig wallet schemas
  createMultiSigWallet: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    cryptocurrency: Joi.string().valid(...NON_LIGHTNING_CRYPTO_SYMBOLS).required(),
    address: Joi.string().required(),
    signers: Joi.array().items(Joi.object({
      email: Joi.string().email().required(),
      publicKey: Joi.string().optional()
    })).min(2).required(),
    requiredSignatures: Joi.number().integer().min(2).required(),
    description: Joi.string().max(500).optional().allow('')
  }),

  updateMultiSigWallet: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    description: Joi.string().max(500).optional().allow(''),
    isActive: Joi.boolean().optional()
  }),

  addSigner: Joi.object({
    email: Joi.string().email().required(),
    publicKey: Joi.string().optional()
  }),

  createTransactionApproval: Joi.object({
    walletId: Joi.string().required(),
    orderId: Joi.string().optional(),
    amount: Joi.number().min(0).required(),
    toAddress: Joi.string().required(),
    fromAddress: Joi.string().optional(),
    cryptocurrency: Joi.string().valid(...NON_LIGHTNING_CRYPTO_SYMBOLS).required(),
    description: Joi.string().max(500).optional().allow(''),
    expiresAt: Joi.date().optional()
  }),

  approveTransaction: Joi.object({
    approved: Joi.boolean().required(),
    comment: Joi.string().max(500).optional().allow('')
  }),

  executeTransaction: Joi.object({
    transactionHash: Joi.string().required()
  }),

  // Lightning Network schemas
  createLightningInvoice: Joi.object({
    orderId: Joi.string().required(),
    expireSeconds: Joi.number().integer().min(60).max(86400).optional()
  }),

  confirmLightningPayment: Joi.object({
    paymentHash: Joi.string().required()
  }),

  decodeLightningPayment: Joi.object({
    paymentRequest: Joi.string().required()
  }),

  openLightningChannel: Joi.object({
    publicKey: Joi.string().required(),
    localAmount: Joi.number().integer().min(20000).required(),
    isPrivate: Joi.boolean().optional()
  }),

  payLightningInvoice: Joi.object({
    paymentRequest: Joi.string().required(),
    maxFee: Joi.number().integer().min(0).optional()
  })
};

// Export validation middleware with specific schemas
const validateReview = validate(schemas.review);
const validateCategory = validate(schemas.createCategory);
const validateUpdateCategory = validate(schemas.updateCategory);
const validateCartItem = validate(schemas.cartItem);
const validateUpdateCartItem = validate(schemas.updateCartItem);
const validateCreateMultiSigWallet = validate(schemas.createMultiSigWallet);
const validateUpdateMultiSigWallet = validate(schemas.updateMultiSigWallet);
const validateAddSigner = validate(schemas.addSigner);
const validateCreateTransactionApproval = validate(schemas.createTransactionApproval);
const validateApproveTransaction = validate(schemas.approveTransaction);
const validateExecuteTransaction = validate(schemas.executeTransaction);

module.exports = { 
  validate, 
  schemas,
  validateReview,
  validateCategory,
  validateUpdateCategory,
  validateCartItem,
  validateUpdateCartItem,
  validateCreateMultiSigWallet,
  validateUpdateMultiSigWallet,
  validateAddSigner,
  validateCreateTransactionApproval,
  validateApproveTransaction,
  validateExecuteTransaction
};
