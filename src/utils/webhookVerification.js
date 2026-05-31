const crypto = require('crypto');
const logger = require('./logger');

// Maximum allowed time difference (5 minutes)
const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000;

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * @param {Object} payload - Webhook payload
 * @param {number} timestamp - Unix timestamp
 * @param {string} secret - Webhook secret (optional, uses env var if not provided)
 * @returns {string} - Hex signature
 */
const generateSignature = (payload, timestamp, secret = null) => {
  const webhookSecret = secret || process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Webhook secret not configured');
  }

  // Create signature payload: timestamp.jsonPayload
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  
  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(signaturePayload);
  return hmac.digest('hex');
};

/**
 * Verify webhook signature and timestamp
 * @param {Object} req - Express request object
 * @returns {Object} - { valid: boolean, error: string|null }
 */
const verifyWebhook = (req) => {
  try {
    // Extract signature and timestamp from headers
    const signature = req.headers['x-signature'] || req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-timestamp'] || req.headers['x-webhook-timestamp'];

    // Check if signature exists
    if (!signature) {
      return {
        valid: false,
        error: 'Missing signature header'
      };
    }

    // Check if timestamp exists
    if (!timestamp) {
      return {
        valid: false,
        error: 'Missing timestamp header'
      };
    }

    // Validate timestamp to prevent replay attacks
    const webhookTimestamp = parseInt(timestamp);
    if (isNaN(webhookTimestamp)) {
      return {
        valid: false,
        error: 'Invalid timestamp format'
      };
    }

    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - webhookTimestamp * 1000);

    if (timeDiff > MAX_TIMESTAMP_DIFF) {
      logger.warn(`Webhook timestamp too old or in future. Diff: ${timeDiff}ms`);
      return {
        valid: false,
        error: 'Timestamp too old or in future (replay attack prevention)'
      };
    }

    // Extract signature value (remove "sha256=" prefix if present)
    const signatureValue = signature.startsWith('sha256=') 
      ? signature.substring(7) 
      : signature;

    // Generate expected signature
    const expectedSignature = generateSignature(req.body, webhookTimestamp);

    // Compare signatures using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      logger.warn('Webhook signature verification failed');
      return {
        valid: false,
        error: 'Invalid signature'
      };
    }

    return {
      valid: true,
      error: null
    };
  } catch (error) {
    logger.error('Webhook verification error:', error);
    return {
      valid: false,
      error: 'Verification failed: ' + error.message
    };
  }
};

/**
 * Verify webhook signature (backward compatibility wrapper)
 * @param {string} signature - Signature from header
 * @param {Object} payload - Webhook payload
 * @param {number} timestamp - Unix timestamp
 * @returns {boolean} - True if valid
 */
const verifySignature = (signature, payload, timestamp) => {
  try {
    const signatureValue = signature.startsWith('sha256=') 
      ? signature.substring(7) 
      : signature;

    const expectedSignature = generateSignature(payload, timestamp);

    return crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Signature verification error:', error);
    return false;
  }
};

module.exports = {
  generateSignature,
  verifyWebhook,
  verifySignature
};
