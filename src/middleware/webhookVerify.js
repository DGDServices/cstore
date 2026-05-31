const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Webhook Verification Middleware
 * Verifies webhook signatures from external services
 */

/**
 * Verify Printify webhook signature
 */
exports.verifyPrintifyWebhook = (req, res, next) => {
  try {
    const signature = req.headers['x-printify-signature'];
    const webhookSecret = process.env.PRINTIFY_WEBHOOK_SECRET;

    // Skip verification in development if configured
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
      logger.warn('Webhook verification skipped in development mode');
      return next();
    }

    if (!webhookSecret) {
      logger.error('Printify webhook secret not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook verification not configured'
      });
    }

    if (!signature) {
      logger.warn('Webhook received without signature');
      return res.status(401).json({
        success: false,
        error: 'Missing webhook signature'
      });
    }

    // Verify signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid webhook signature received');
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    logger.info('Printify webhook signature verified');
    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};

/**
 * Verify exchange webhook signature (generic)
 */
exports.verifyExchangeWebhook = (exchangeName) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['signature'];
      const webhookSecret = process.env[`${exchangeName.toUpperCase()}_WEBHOOK_SECRET`];

      // Skip verification in development if configured
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
        logger.warn(`${exchangeName} webhook verification skipped in development mode`);
        return next();
      }

      if (!webhookSecret) {
        logger.error(`${exchangeName} webhook secret not configured`);
        return res.status(500).json({
          success: false,
          error: 'Webhook verification not configured'
        });
      }

      if (!signature) {
        logger.warn(`${exchangeName} webhook received without signature`);
        return res.status(401).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      // Verify signature (method depends on exchange)
      const payload = JSON.stringify(req.body);
      let expectedSignature;

      switch (exchangeName.toLowerCase()) {
        case 'coinbase':
          expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');
          break;
        
        case 'kraken':
          expectedSignature = crypto
            .createHmac('sha512', webhookSecret)
            .update(payload)
            .digest('hex');
          break;
        
        case 'binance':
          expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');
          break;
        
        default:
          logger.error(`Unknown exchange: ${exchangeName}`);
          return res.status(500).json({
            success: false,
            error: 'Unknown exchange'
          });
      }

      if (signature !== expectedSignature) {
        logger.warn(`Invalid ${exchangeName} webhook signature received`);
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      logger.info(`${exchangeName} webhook signature verified`);
      next();
    } catch (error) {
      logger.error(`${exchangeName} webhook verification error:`, error);
      res.status(500).json({
        success: false,
        error: 'Webhook verification failed'
      });
    }
  };
};

/**
 * Validate webhook payload
 */
exports.validateWebhookPayload = (requiredFields = []) => {
  return (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook payload'
        });
      }

      // Check required fields
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Webhook payload validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Payload validation failed'
      });
    }
  };
};

/**
 * Log webhook events
 */
exports.logWebhook = (source) => {
  return (req, res, next) => {
    const logData = {
      source,
      event: req.body.event || req.body.type,
      timestamp: new Date(),
      ip: req.ip,
      headers: {
        signature: req.headers['x-signature'] || req.headers['signature'],
        contentType: req.headers['content-type']
      }
    };

    logger.info(`Webhook received from ${source}:`, logData);
    next();
  };
};

/**
 * Rate limit webhooks
 */
exports.webhookRateLimit = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    // Clean old entries
    for (const [ip, data] of requests.entries()) {
      if (now - data.timestamp > windowMs) {
        requests.delete(ip);
      }
    }

    // Check rate limit
    const requestData = requests.get(key);
    if (requestData) {
      if (requestData.count >= maxRequests) {
        logger.warn(`Webhook rate limit exceeded for ${key}`);
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded'
        });
      }
      requestData.count++;
    } else {
      requests.set(key, {
        count: 1,
        timestamp: now
      });
    }

    next();
  };
};
