const logger = require('../utils/logger');
const conversionConfig = require('../../config/conversion');

/**
 * Conversion Authentication Middleware
 * Validates permissions and limits for conversion operations
 */

/**
 * Check if user can initiate conversions
 */
exports.canInitiateConversion = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user account is active
    if (req.user.status === 'suspended' || req.user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active'
      });
    }

    next();
  } catch (error) {
    logger.error('Conversion auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Check if user can approve conversions
 */
exports.canApproveConversion = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Only admins can approve conversions
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    next();
  } catch (error) {
    logger.error('Conversion approval auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization failed'
    });
  }
};

/**
 * Validate conversion amount
 */
exports.validateConversionAmount = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversion amount'
      });
    }

    const limits = conversionConfig.limits;

    if (amount < limits.minAmount) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${limits.minAmount}`
      });
    }

    if (amount > limits.maxAmount) {
      return res.status(400).json({
        success: false,
        error: `Amount cannot exceed ${limits.maxAmount}`
      });
    }

    next();
  } catch (error) {
    logger.error('Amount validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
};

/**
 * Check daily conversion limits
 */
exports.checkDailyLimits = async (req, res, next) => {
  try {
    const riskService = require('../services/riskService');
    const { amount } = req.body;
    const userId = req.user?._id;

    const limits = await riskService.checkDailyLimits(userId);

    // Check total daily limit
    if (!limits.withinLimit) {
      return res.status(429).json({
        success: false,
        error: 'Daily conversion limit reached',
        data: limits
      });
    }

    // Check user daily limit
    if (userId && !limits.userWithinLimit) {
      return res.status(429).json({
        success: false,
        error: 'User daily conversion limit reached',
        data: limits
      });
    }

    // Check if new conversion would exceed limit
    if (amount && (limits.remainingLimit < amount)) {
      return res.status(429).json({
        success: false,
        error: 'Conversion would exceed daily limit',
        data: limits
      });
    }

    next();
  } catch (error) {
    logger.error('Daily limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Limit check failed'
    });
  }
};

/**
 * Rate limiting for conversion API
 */
exports.conversionRateLimit = (req, res, next) => {
  // This would typically integrate with express-rate-limit
  // For now, just pass through
  next();
};

/**
 * Audit logging for conversions
 */
exports.auditConversion = (req, res, next) => {
  const logData = {
    userId: req.user?._id,
    email: req.user?.email,
    action: req.method + ' ' + req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date()
  };

  logger.info('Conversion API access:', logData);
  next();
};

/**
 * Validate conversion request body
 */
exports.validateConversionRequest = (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Validate MongoDB ObjectId format
    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    next();
  } catch (error) {
    logger.error('Request validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
};
