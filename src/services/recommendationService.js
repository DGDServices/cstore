const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Get product recommendations based on user's purchase history
 * Uses collaborative filtering approach:
 * 1. Find products the user has purchased
 * 2. Find other users who purchased similar products
 * 3. Recommend products those users also purchased
 * 4. Include products from same categories
 */
class RecommendationService {
  /**
   * Get personalized recommendations for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Maximum number of recommendations
   * @returns {Array} Array of recommended products
   */
  async getRecommendationsForUser(userId, limit = 10) {
    try {
      // Get user's purchase history
      const userOrders = await Order.find({
        user: userId,
        status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
      }).select('items');

      if (!userOrders || userOrders.length === 0) {
        // New user - return popular products
        return this.getPopularProducts(limit);
      }

      // Extract product IDs from user's orders
      const purchasedProductIds = new Set();
      const purchasedCategories = new Set();

      for (const order of userOrders) {
        for (const item of order.items) {
          purchasedProductIds.add(item.product.toString());
        }
      }

      // Get category information for purchased products
      const purchasedProducts = await Product.find({
        _id: { $in: Array.from(purchasedProductIds) }
      }).select('category');

      purchasedProducts.forEach(product => {
        if (product.category) {
          purchasedCategories.add(product.category.toString());
        }
      });

      // Find other users who bought similar products
      const similarUserOrders = await Order.aggregate([
        {
          $match: {
            user: { $ne: userId, $exists: true },
            status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
            'items.product': { $in: Array.from(purchasedProductIds).map(id => mongoose.Types.ObjectId(id)) }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            purchaseCount: { $sum: '$items.quantity' }
          }
        },
        { $sort: { purchaseCount: -1 } },
        { $limit: limit * 2 } // Get more to filter out already purchased
      ]);

      const recommendedProductIds = similarUserOrders
        .map(item => item._id.toString())
        .filter(id => !purchasedProductIds.has(id));

      // Get products from same categories
      const categoryBasedProducts = await Product.find({
        category: { $in: Array.from(purchasedCategories) },
        _id: { $nin: Array.from(purchasedProductIds) },
        isActive: true,
        stock: { $gt: 0 }
      })
        .sort('-averageRating -numReviews')
        .limit(limit)
        .select('_id');

      // Combine recommendations
      const allRecommendedIds = [
        ...recommendedProductIds,
        ...categoryBasedProducts.map(p => p._id.toString())
      ];

      // Remove duplicates and limit
      const uniqueIds = [...new Set(allRecommendedIds)].slice(0, limit);

      // Fetch full product details
      const recommendations = await Product.find({
        _id: { $in: uniqueIds },
        isActive: true
      })
        .populate('category', 'name slug')
        .select('name description price priceUSD image averageRating numReviews stock category');

      // Sort by rating and reviews
      recommendations.sort((a, b) => {
        const scoreA = (a.averageRating * a.numReviews) || 0;
        const scoreB = (b.averageRating * b.numReviews) || 0;
        return scoreB - scoreA;
      });

      return recommendations;
    } catch (error) {
      logger.error('Error getting recommendations:', error);
      // Fallback to popular products
      return this.getPopularProducts(limit);
    }
  }

  /**
   * Get popular products (fallback for new users)
   * @param {Number} limit - Maximum number of products
   * @returns {Array} Array of popular products
   */
  async getPopularProducts(limit = 10) {
    try {
      // Get most sold products
      const popularProducts = await Order.aggregate([
        {
          $match: {
            status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit }
      ]);

      const productIds = popularProducts.map(p => p._id);

      const products = await Product.find({
        _id: { $in: productIds },
        isActive: true
      })
        .populate('category', 'name slug')
        .select('name description price priceUSD image averageRating numReviews stock category');

      // Sort by the order from aggregation
      products.sort((a, b) => {
        const indexA = productIds.findIndex(id => id.toString() === a._id.toString());
        const indexB = productIds.findIndex(id => id.toString() === b._id.toString());
        return indexA - indexB;
      });

      return products;
    } catch (error) {
      logger.error('Error getting popular products:', error);
      // Final fallback - just return featured or recent products
      return Product.find({ isActive: true, stock: { $gt: 0 } })
        .populate('category', 'name slug')
        .sort('-featured -createdAt')
        .limit(limit)
        .select('name description price priceUSD image averageRating numReviews stock category');
    }
  }

  /**
   * Get recommendations based on a specific product
   * @param {String} productId - Product ID
   * @param {Number} limit - Maximum number of recommendations
   * @returns {Array} Array of related products
   */
  async getRelatedProducts(productId, limit = 6) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        return [];
      }

      // Find products in same category
      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        category: product.category,
        isActive: true,
        stock: { $gt: 0 }
      })
        .populate('category', 'name slug')
        .sort('-averageRating -numReviews')
        .limit(limit)
        .select('name description price priceUSD image averageRating numReviews stock category');

      return relatedProducts;
    } catch (error) {
      logger.error('Error getting related products:', error);
      return [];
    }
  }
}

module.exports = new RecommendationService();
