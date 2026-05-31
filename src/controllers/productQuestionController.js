const ProductQuestion = require('../models/ProductQuestion');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

/**
 * Create a new product question
 * POST /api/questions
 * @access Private
 */
exports.createQuestion = async (req, res, next) => {
  try {
    const { productId, question } = req.body;
    const userId = req.user.id;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Create question
    const productQuestion = await ProductQuestion.create({
      product: productId,
      user: userId,
      question
    });

    // Populate user details
    await productQuestion.populate('user', 'name email');

    // Send notification to admin
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await emailService.sendAdminAlert(
          admin.email,
          'New Product Question',
          `A new question has been posted on product "${product.name}":\n\nQuestion: ${question}\n\nAsked by: ${req.user.name}`
        );
      }
    } catch (emailError) {
      logger.warn('Failed to send question notification email:', emailError);
    }

    res.status(201).json({
      success: true,
      data: productQuestion
    });
  } catch (error) {
    logger.error('Error creating product question:', error);
    next(error);
  }
};

/**
 * Get all questions for a product
 * GET /api/questions/product/:productId
 * @access Public
 */
exports.getProductQuestions = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Only show approved questions to non-admin users
    const filter = { product: productId };
    if (!req.user || req.user.role !== 'admin') {
      filter.isApproved = true;
    }

    const questions = await ProductQuestion.find(filter)
      .populate('user', 'name')
      .populate('answers.user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ProductQuestion.countDocuments(filter);

    res.json({
      success: true,
      data: questions,
      count: questions.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching product questions:', error);
    next(error);
  }
};

/**
 * Get a single question by ID
 * GET /api/questions/:id
 * @access Public
 */
exports.getQuestion = async (req, res, next) => {
  try {
    const question = await ProductQuestion.findById(req.params.id)
      .populate('user', 'name')
      .populate('answers.user', 'name')
      .populate('product', 'name');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if question is approved or user is admin/owner
    if (!question.isApproved && 
        (!req.user || (req.user.role !== 'admin' && req.user.id !== question.user._id.toString()))) {
      return res.status(403).json({
        success: false,
        message: 'Question not available'
      });
    }

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error fetching question:', error);
    next(error);
  }
};

/**
 * Get all questions by current user
 * GET /api/questions/my-questions
 * @access Private
 */
exports.getMyQuestions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const questions = await ProductQuestion.find({ user: req.user.id })
      .populate('product', 'name image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ProductQuestion.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      data: questions,
      count: questions.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching user questions:', error);
    next(error);
  }
};

/**
 * Add an answer to a question
 * POST /api/questions/:id/answers
 * @access Private
 */
exports.addAnswer = async (req, res, next) => {
  try {
    const { text } = req.body;
    const questionId = req.params.id;
    const userId = req.user.id;

    const question = await ProductQuestion.findById(questionId)
      .populate('user', 'name email')
      .populate('product', 'name');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if answer is from seller or admin
    const isSellerOrAdmin = req.user.role === 'admin' || req.user.role === 'seller';

    // Add answer
    question.answers.push({
      user: userId,
      text,
      isSellerOrAdmin
    });

    await question.save();

    // Populate the new answer's user details
    await question.populate('answers.user', 'name');

    // Send notification to question asker
    try {
      if (question.user._id.toString() !== userId) {
        await emailService.sendEmail({
          to: question.user.email,
          subject: 'Your Product Question Has Been Answered',
          html: `
            <h2>Your question has been answered!</h2>
            <p>Someone has answered your question about "${question.product.name}":</p>
            <p><strong>Your Question:</strong> ${question.question}</p>
            <p><strong>Answer:</strong> ${text}</p>
            <p>Visit the product page to see the full answer.</p>
          `
        });
      }
    } catch (emailError) {
      logger.warn('Failed to send answer notification email:', emailError);
    }

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error adding answer:', error);
    next(error);
  }
};

/**
 * Update a question (only by owner)
 * PUT /api/questions/:id
 * @access Private
 */
exports.updateQuestion = async (req, res, next) => {
  try {
    const { question } = req.body;
    const questionDoc = await ProductQuestion.findById(req.params.id);

    if (!questionDoc) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if user owns the question
    if (questionDoc.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this question'
      });
    }

    questionDoc.question = question || questionDoc.question;
    await questionDoc.save();

    res.json({
      success: true,
      data: questionDoc
    });
  } catch (error) {
    logger.error('Error updating question:', error);
    next(error);
  }
};

/**
 * Delete a question (only by owner or admin)
 * DELETE /api/questions/:id
 * @access Private
 */
exports.deleteQuestion = async (req, res, next) => {
  try {
    const question = await ProductQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if user owns the question or is admin
    if (question.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this question'
      });
    }

    await ProductQuestion.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      data: {},
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting question:', error);
    next(error);
  }
};

/**
 * Update answer (only by answer owner or admin)
 * PUT /api/questions/:questionId/answers/:answerId
 * @access Private
 */
exports.updateAnswer = async (req, res, next) => {
  try {
    const { text } = req.body;
    const { questionId, answerId } = req.params;

    const question = await ProductQuestion.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const answer = question.answers.id(answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    // Check if user owns the answer or is admin
    if (answer.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this answer'
      });
    }

    answer.text = text;
    await question.save();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error updating answer:', error);
    next(error);
  }
};

/**
 * Delete answer (only by answer owner or admin)
 * DELETE /api/questions/:questionId/answers/:answerId
 * @access Private
 */
exports.deleteAnswer = async (req, res, next) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await ProductQuestion.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const answer = question.answers.id(answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    // Check if user owns the answer or is admin
    if (answer.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this answer'
      });
    }

    answer.deleteOne();
    await question.save();

    res.json({
      success: true,
      data: {},
      message: 'Answer deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting answer:', error);
    next(error);
  }
};

/**
 * Mark question as helpful
 * POST /api/questions/:id/helpful
 * @access Private
 */
exports.markQuestionHelpful = async (req, res, next) => {
  try {
    const question = await ProductQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    question.helpfulCount += 1;
    await question.save();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error marking question as helpful:', error);
    next(error);
  }
};

/**
 * Mark answer as helpful
 * POST /api/questions/:questionId/answers/:answerId/helpful
 * @access Private
 */
exports.markAnswerHelpful = async (req, res, next) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await ProductQuestion.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const answer = question.answers.id(answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    answer.helpfulCount += 1;
    await question.save();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error marking answer as helpful:', error);
    next(error);
  }
};

// Admin-only endpoints

/**
 * Get all pending questions for moderation
 * GET /api/questions/admin/pending
 * @access Private (Admin only)
 */
exports.getPendingQuestions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const questions = await ProductQuestion.find({ isApproved: false })
      .populate('user', 'name email')
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ProductQuestion.countDocuments({ isApproved: false });

    res.json({
      success: true,
      data: questions,
      count: questions.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching pending questions:', error);
    next(error);
  }
};

/**
 * Approve a question
 * PUT /api/questions/:id/approve
 * @access Private (Admin only)
 */
exports.approveQuestion = async (req, res, next) => {
  try {
    const question = await ProductQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    question.isApproved = true;
    question.status = 'approved';
    await question.save();

    res.json({
      success: true,
      data: question,
      message: 'Question approved successfully'
    });
  } catch (error) {
    logger.error('Error approving question:', error);
    next(error);
  }
};

/**
 * Reject a question
 * PUT /api/questions/:id/reject
 * @access Private (Admin only)
 */
exports.rejectQuestion = async (req, res, next) => {
  try {
    const question = await ProductQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    question.isApproved = false;
    question.status = 'rejected';
    await question.save();

    res.json({
      success: true,
      data: question,
      message: 'Question rejected successfully'
    });
  } catch (error) {
    logger.error('Error rejecting question:', error);
    next(error);
  }
};

/**
 * Get question statistics
 * GET /api/questions/admin/stats
 * @access Private (Admin only)
 */
exports.getQuestionStats = async (req, res, next) => {
  try {
    const totalQuestions = await ProductQuestion.countDocuments();
    const pendingQuestions = await ProductQuestion.countDocuments({ isApproved: false });
    const approvedQuestions = await ProductQuestion.countDocuments({ isApproved: true });
    const questionsWithAnswers = await ProductQuestion.countDocuments({ 'answers.0': { $exists: true } });
    const unansweredQuestions = await ProductQuestion.countDocuments({ answers: { $size: 0 } });

    res.json({
      success: true,
      data: {
        totalQuestions,
        pendingQuestions,
        approvedQuestions,
        questionsWithAnswers,
        unansweredQuestions
      }
    });
  } catch (error) {
    logger.error('Error fetching question stats:', error);
    next(error);
  }
};
