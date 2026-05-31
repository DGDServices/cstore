const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const logger = require('../utils/logger');

/**
 * Create a new review
 * POST /api/reviews
 * @access Private
 */
exports.createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment, orderId } = req.body;
    const userId = req.user.id;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ product: productId, user: userId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Check if this is a verified purchase
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        'items.product': productId,
        status: 'completed'
      });
      isVerifiedPurchase = !!order;
    }

    // Create review
    const review = await Review.create({
      product: productId,
      user: userId,
      order: orderId || null,
      rating,
      title,
      comment,
      isVerifiedPurchase
    });

    // Populate user info
    await review.populate('user', 'name email');

    // Update product rating statistics
    await updateProductRating(productId);

    logger.info(`Review created: ${review._id} for product ${productId}`);

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    logger.error('Create review error:', error);
    next(error);
  }
};

/**
 * Get all reviews for a product
 * GET /api/reviews/product/:productId
 * @access Public
 */
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const query = { 
      product: productId,
      isApproved: true 
    };

    const reviews = await Review.find(query)
      .populate('user', 'name')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Get product reviews error:', error);
    next(error);
  }
};

/**
 * Get a single review
 * GET /api/reviews/:id
 * @access Public
 */
exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name')
      .populate('product', 'name image');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    logger.error('Get review error:', error);
    next(error);
  }
};

/**
 * Get current user's reviews
 * GET /api/reviews/my-reviews
 * @access Private
 */
exports.getUserReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const reviews = await Review.find({ user: userId })
      .populate('product', 'name image price')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Review.countDocuments({ user: userId });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Get user reviews error:', error);
    next(error);
  }
};

/**
 * Update a review
 * PUT /api/reviews/:id
 * @access Private (Review owner)
 */
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;
    const userId = req.user.id;

    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Update fields
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;

    await review.save();
    await review.populate('user', 'name email');

    // Update product rating statistics
    await updateProductRating(review.product);

    logger.info(`Review updated: ${review._id}`);

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    logger.error('Update review error:', error);
    next(error);
  }
};

/**
 * Delete a review
 * DELETE /api/reviews/:id
 * @access Private (Review owner or Admin)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review or is admin
    if (review.user.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    const productId = review.product;
    await review.deleteOne();

    // Update product rating statistics
    await updateProductRating(productId);

    logger.info(`Review deleted: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    logger.error('Delete review error:', error);
    next(error);
  }
};

/**
 * Mark review as helpful
 * PUT /api/reviews/:id/helpful
 * @access Public
 */
exports.markHelpful = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    logger.error('Mark helpful error:', error);
    next(error);
  }
};

/**
 * Approve/reject review (Admin only)
 * PUT /api/reviews/:id/approve
 * @access Private (Admin)
 */
exports.approveReview = async (req, res, next) => {
  try {
    const { isApproved } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    ).populate('user', 'name').populate('product', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    logger.info(`Review ${isApproved ? 'approved' : 'rejected'}: ${review._id}`);

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    logger.error('Approve review error:', error);
    next(error);
  }
};

/**
 * Get review statistics for a product
 * GET /api/reviews/product/:productId/stats
 * @access Public
 */
exports.getReviewStats = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const stats = await Review.aggregate([
      { $match: { product: productId, isApproved: true } },
      {
        $group: {
          _id: '$product',
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: {
            $push: '$rating'
          }
        }
      },
      {
        $project: {
          totalReviews: 1,
          averageRating: { $round: ['$averageRating', 1] },
          ratingDistribution: {
            5: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 5] }
                }
              }
            },
            4: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 4] }
                }
              }
            },
            3: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 3] }
                }
              }
            },
            2: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 2] }
                }
              }
            },
            1: {
              $size: {
                $filter: {
                  input: '$ratings',
                  cond: { $eq: ['$$this', 1] }
                }
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    });
  } catch (error) {
    logger.error('Get review stats error:', error);
    next(error);
  }
};

/**
 * Helper function to update product rating
 * @param {string} productId - Product ID
 */
async function updateProductRating(productId) {
  try {
    const stats = await Review.aggregate([
      { $match: { product: productId, isApproved: true } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          numReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        numReviews: stats[0].numReviews
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        averageRating: 0,
        numReviews: 0
      });
    }
  } catch (error) {
    logger.error('Update product rating error:', error);
  }
}
