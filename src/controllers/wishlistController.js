const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const logger = require('../utils/logger');

/**
 * Get user's wishlist
 * GET /api/wishlist
 * @access Private
 */
exports.getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id })
      .populate('items.product', 'name price priceUSD currency image stock isActive');

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id, items: [] });
    }

    // Filter out inactive products or products with 0 stock
    wishlist.items = wishlist.items.filter(item => 
      item.product && item.product.isActive && item.product.stock > 0
    );

    await wishlist.save();

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    logger.error('Get wishlist error:', error);
    next(error);
  }
};

/**
 * Add item to wishlist
 * POST /api/wishlist/items
 * @access Private
 */
exports.addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
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

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, items: [] });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      item => item.product.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    // Add new item
    wishlist.items.push({
      product: productId
    });

    await wishlist.save();
    await wishlist.populate('items.product', 'name price priceUSD currency image stock isActive');

    logger.info(`Item added to wishlist: ${productId} for user ${userId}`);

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    logger.error('Add to wishlist error:', error);
    next(error);
  }
};

/**
 * Remove item from wishlist
 * DELETE /api/wishlist/items/:productId
 * @access Private
 */
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.items = wishlist.items.filter(
      item => item.product.toString() !== productId
    );

    await wishlist.save();
    await wishlist.populate('items.product', 'name price priceUSD currency image stock isActive');

    logger.info(`Item removed from wishlist: ${productId} for user ${userId}`);

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    logger.error('Remove from wishlist error:', error);
    next(error);
  }
};

/**
 * Clear wishlist
 * DELETE /api/wishlist
 * @access Private
 */
exports.clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.items = [];
    await wishlist.save();

    logger.info(`Wishlist cleared for user ${userId}`);

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      data: wishlist
    });
  } catch (error) {
    logger.error('Clear wishlist error:', error);
    next(error);
  }
};
