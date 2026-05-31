const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const currencyService = require('../services/currencyService');

/**
 * Get user's cart
 * GET /api/cart
 * @access Private
 */
exports.getCart = async (req, res, next) => {
  try {
    const { currency } = req.query;

    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price priceUSD currency image stock isActive');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Filter out inactive products or products with 0 stock
    cart.items = cart.items.filter(item => 
      item.product && item.product.isActive && item.product.stock > 0
    );

    await cart.save();

    // If currency is requested and different from USD, convert prices
    let cartData = cart.toObject();
    if (currency && currency.toUpperCase() !== 'USD') {
      const user = await User.findById(req.user.id);
      const targetCurrency = currency.toUpperCase();

      try {
        const conversion = await currencyService.convertCurrency(
          cart.totalPriceUSD,
          'USD',
          targetCurrency
        );

        cartData.displayCurrency = targetCurrency;
        cartData.displayPrice = conversion.convertedAmount;
        cartData.exchangeRate = conversion.exchangeRate;
      } catch (error) {
        logger.warn(`Currency conversion failed: ${error.message}`);
        // Continue without conversion
      }
    }

    res.json({
      success: true,
      data: cartData
    });
  } catch (error) {
    logger.error('Get cart error:', error);
    next(error);
  }
};

/**
 * Add item to cart
 * POST /api/cart/items
 * @access Private
 */
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than ${product.stock} items`
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = product.price;
      cart.items[existingItemIndex].priceUSD = product.priceUSD;
      cart.items[existingItemIndex].currency = product.currency;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
        priceUSD: product.priceUSD,
        currency: product.currency
      });
    }

    await cart.save();
    await cart.populate('items.product', 'name price priceUSD currency image stock isActive');

    logger.info(`Item added to cart: ${productId} for user ${userId}`);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    logger.error('Add to cart error:', error);
    next(error);
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items/:productId
 * @access Private
 */
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Validate stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`
        });
      }

      // Update quantity
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].price = product.price;
      cart.items[itemIndex].priceUSD = product.priceUSD;
      cart.items[itemIndex].currency = product.currency;
    }

    await cart.save();
    await cart.populate('items.product', 'name price priceUSD currency image stock isActive');

    logger.info(`Cart updated for user ${userId}`);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    logger.error('Update cart item error:', error);
    next(error);
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items/:productId
 * @access Private
 */
exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();
    await cart.populate('items.product', 'name price priceUSD currency image stock isActive');

    logger.info(`Item removed from cart: ${productId} for user ${userId}`);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    logger.error('Remove from cart error:', error);
    next(error);
  }
};

/**
 * Clear cart
 * DELETE /api/cart
 * @access Private
 */
exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    logger.info(`Cart cleared for user ${userId}`);

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    logger.error('Clear cart error:', error);
    next(error);
  }
};

/**
 * Validate cart (check stock availability and prices)
 * POST /api/cart/validate
 * @access Private
 */
exports.validateCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    const issues = [];
    const validItems = [];

    for (const item of cart.items) {
      if (!item.product) {
        issues.push({
          issue: 'Product no longer exists',
          itemId: item._id
        });
        continue;
      }

      if (!item.product.isActive) {
        issues.push({
          issue: 'Product is no longer available',
          productId: item.product._id,
          productName: item.product.name
        });
        continue;
      }

      if (item.product.stock < item.quantity) {
        issues.push({
          issue: 'Insufficient stock',
          productId: item.product._id,
          productName: item.product.name,
          requested: item.quantity,
          available: item.product.stock
        });
        continue;
      }

      if (item.price !== item.product.price || item.priceUSD !== item.product.priceUSD) {
        issues.push({
          issue: 'Price has changed',
          productId: item.product._id,
          productName: item.product.name,
          oldPrice: item.priceUSD,
          newPrice: item.product.priceUSD
        });
        // Update price but don't mark as invalid
        item.price = item.product.price;
        item.priceUSD = item.product.priceUSD;
        validItems.push(item);
      } else {
        validItems.push(item);
      }
    }

    if (issues.length > 0) {
      await cart.save();
      return res.status(400).json({
        success: false,
        message: 'Cart validation failed',
        issues,
        validItems: validItems.length
      });
    }

    res.json({
      success: true,
      message: 'Cart is valid',
      data: cart
    });
  } catch (error) {
    logger.error('Validate cart error:', error);
    next(error);
  }
};
