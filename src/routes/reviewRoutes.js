const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validateReview } = require('../middleware/validation');
const {
  createReview,
  getProductReviews,
  getReview,
  getUserReviews,
  updateReview,
  deleteReview,
  markHelpful,
  approveReview,
  getReviewStats
} = require('../controllers/reviewController');

// Public routes
router.get('/product/:productId', getProductReviews);
router.get('/product/:productId/stats', getReviewStats);
router.get('/:id', getReview);
router.put('/:id/helpful', markHelpful);

// Protected routes (require authentication)
router.post('/', protect, validateReview, createReview);
router.get('/my-reviews', protect, getUserReviews);
router.put('/:id', protect, validateReview, updateReview);
router.delete('/:id', protect, deleteReview);

// Admin routes
router.put('/:id/approve', protect, authorize('admin'), approveReview);

module.exports = router;
