const Joi = require('joi');
const { AppError } = require('./errorHandler');

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
    // The marketplace settles in DGD only; a client may say so, but may not pick anything else.
    cryptocurrency: Joi.string().valid('DGD').optional(),
    shippingAddress: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      postalCode: Joi.string(),
      country: Joi.string()
    }).optional()
  }),

  // Confirm payment

  // Create product (admin)
  createProduct: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(2000).required(),
    price: Joi.number().min(0).required(),
    priceUSD: Joi.number().min(0).required(),
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

  // Create/Update product question. productId is optional so the same
  // validator serves POST /questions (productId in body) and PUT /questions/:id
  // (productId comes from the route — only the text changes).
  question: Joi.object({
    productId: Joi.string().optional(),
    question: Joi.string().min(10).max(500).required()
  }),

  // Add/Update an answer to a product question.
  answer: Joi.object({
    text: Joi.string().min(1).max(1000).required()
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


};

// Export validation middleware with specific schemas
const validateReview = validate(schemas.review);
const validateQuestion = validate(schemas.question);
const validateAnswer = validate(schemas.answer);
const validateCategory = validate(schemas.createCategory);
const validateUpdateCategory = validate(schemas.updateCategory);
const validateCartItem = validate(schemas.cartItem);
const validateUpdateCartItem = validate(schemas.updateCartItem);

module.exports = { 
  validate, 
  schemas,
  validateReview,
  validateQuestion,
  validateAnswer,
  validateCategory,
  validateUpdateCategory,
  validateCartItem,
  validateUpdateCartItem,
};
