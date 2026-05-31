const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify Printify webhook signature
 * Uses HMAC-SHA256 for signature verification
 */
const verifyPrintifyWebhook = (req, res, next) => {
  // Skip verification if explicitly disabled (development only)
  if (process.env.SKIP_WEBHOOK_VERIFICATION === 'true' && process.env.NODE_ENV === 'development') {
    logger.warn('Webhook signature verification is disabled - development mode only');
    return next();
  }
  
  const webhookSecret = process.env.PRINTIFY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.error('Printify webhook secret is not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook verification not configured'
    });
  }
  
  // Get signature from header
  const signature = req.headers['x-printify-signature'];
  
  if (!signature) {
    logger.warn('Missing Printify webhook signature');
    return res.status(401).json({
      success: false,
      error: 'Missing webhook signature'
    });
  }
  
  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!isValid) {
      logger.warn('Invalid Printify webhook signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }
    
    logger.info('Printify webhook signature verified successfully');
    next();
  } catch (error) {
    logger.error('Error verifying Printify webhook signature:', error);
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
};

module.exports = {
  verifyPrintifyWebhook
};
