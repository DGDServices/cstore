const webhookVerification = require('../utils/webhookVerification');
const logger = require('../utils/logger');

/**
 * Middleware to verify webhook authenticity
 * Validates HMAC-SHA256 signature and timestamp to prevent:
 * - Unauthorized webhook calls
 * - Replay attacks
 * - Man-in-the-middle attacks
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Skip verification in development if explicitly disabled
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
      logger.warn('Webhook signature verification skipped (development mode)');
      return next();
    }

    // Check if webhook secret is configured
    if (!process.env.WEBHOOK_SECRET) {
      logger.error('Webhook secret not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook authentication not configured'
      });
    }

    const verification = webhookVerification.verifyWebhook(req);
    
    if (!verification.valid) {
      logger.warn('Webhook verification failed:', {
        error: verification.error,
        ip: req.ip,
        path: req.path,
        headers: {
          signature: req.headers['x-signature'] ? 'present' : 'missing',
          timestamp: req.headers['x-timestamp'] ? 'present' : 'missing'
        }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Webhook verification failed',
        message: verification.error
      });
    }
    
    logger.info('Webhook verified successfully', {
      path: req.path,
      timestamp: req.headers['x-timestamp'],
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Webhook verification error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Optional webhook verification - logs but doesn't block invalid webhooks
 * Useful for gradual rollout or monitoring
 */
const optionalWebhookVerification = (req, res, next) => {
  try {
    if (!process.env.WEBHOOK_SECRET) {
      logger.warn('Webhook secret not configured, skipping verification');
      return next();
    }

    const verification = webhookVerification.verifyWebhook(req);
    
    if (!verification.valid) {
      logger.warn('Optional webhook verification failed (not blocking):', {
        error: verification.error,
        ip: req.ip,
        path: req.path
      });
      // Add flag to request but don't block
      req.webhookVerified = false;
    } else {
      logger.info('Optional webhook verified successfully', {
        path: req.path,
        timestamp: req.headers['x-timestamp']
      });
      req.webhookVerified = true;
    }
    
    next();
  } catch (error) {
    logger.error('Optional webhook verification error:', error);
    req.webhookVerified = false;
    next();
  }
};

module.exports = {
  verifyWebhookSignature,
  optionalWebhookVerification
};
