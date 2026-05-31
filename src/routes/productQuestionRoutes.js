const express = require('express');
const router = express.Router();
const {
  createQuestion,
  getProductQuestions,
  getQuestion,
  getMyQuestions,
  addAnswer,
  updateQuestion,
  deleteQuestion,
  updateAnswer,
  deleteAnswer,
  markQuestionHelpful,
  markAnswerHelpful,
  getPendingQuestions,
  approveQuestion,
  rejectQuestion,
  getQuestionStats
} = require('../controllers/productQuestionController');
const { protect, authorize } = require('../middleware/auth');
const { validateQuestion, validateAnswer } = require('../middleware/validation');

// Public routes
router.get('/product/:productId', getProductQuestions);
router.get('/:id', getQuestion);

// Protected routes (authentication required)
router.post('/', protect, validateQuestion, createQuestion);
router.get('/user/my-questions', protect, getMyQuestions);
router.put('/:id', protect, validateQuestion, updateQuestion);
router.delete('/:id', protect, deleteQuestion);

// Answer routes
router.post('/:id/answers', protect, validateAnswer, addAnswer);
router.put('/:questionId/answers/:answerId', protect, validateAnswer, updateAnswer);
router.delete('/:questionId/answers/:answerId', protect, deleteAnswer);

// Helpful routes
router.post('/:id/helpful', protect, markQuestionHelpful);
router.post('/:questionId/answers/:answerId/helpful', protect, markAnswerHelpful);

// Admin routes
router.get('/admin/pending', protect, authorize('admin'), getPendingQuestions);
router.get('/admin/stats', protect, authorize('admin'), getQuestionStats);
router.put('/:id/approve', protect, authorize('admin'), approveQuestion);
router.put('/:id/reject', protect, authorize('admin'), rejectQuestion);

module.exports = router;
