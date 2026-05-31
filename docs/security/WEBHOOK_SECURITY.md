# Webhook Signature Verification Implementation Guide

**Status**: 🔴 CRITICAL - Not Implemented  
**Priority**: HIGH  
**CVSS Score**: 7.5 (HIGH)  
**Timeline**: 1-2 weeks

---

## Overview

Payment webhooks are currently not verified for authenticity, allowing potential attackers to spoof webhook calls and manipulate payment status. This guide implements HMAC-based signature verification for all incoming webhooks.

## Problem Statement

**Current Vulnerability:**
- Webhooks accepted without verification
- Attackers can fake payment confirmations
- No replay attack protection
- Potential for financial fraud

**Attack Scenarios:**
1. **Webhook Spoofing**: Attacker sends fake "payment confirmed" webhook
2. **Replay Attacks**: Old webhook replayed multiple times
3. **Man-in-the-Middle**: Webhook data modified in transit
4. **Unauthorized Access**: Anyone can trigger webhook endpoints

## Recommended Solution: HMAC Signature Verification

### Architecture

```
┌──────────────────┐                    ┌──────────────────┐
│  Payment Gateway │                    │  Cryptons.com    │
│  (e.g., BTCPay)  │                    │     Server       │
└──────────────────┘                    └──────────────────┘
         │                                       │
         │  1. Create webhook payload            │
         │  2. Sign with HMAC-SHA256            │
         │  3. Add X-Signature header           │
         │                                       │
         │─────── POST /webhooks/payment ──────▶│
         │        Headers:                       │
         │        X-Signature: sha256=abc123     │
         │        Body: {...}                    │
         │                                       │
         │                      4. Verify        │
         │                         Signature     │
         │                      5. Process if    │
         │                         Valid         │
         │                                       │
         │◀────── 200 OK or 401 Unauthorized ───│
```

### Implementation Steps

#### 1. Update Environment Variables

Add to `.env`:

```env
# Webhook Security
WEBHOOK_SECRET=your-super-secret-webhook-key-change-in-production
WEBHOOK_SIGNATURE_ALGORITHM=sha256
WEBHOOK_REPLAY_WINDOW=300
```

Update `.env.example`:

```env
# Webhook Security (CRITICAL for production)
WEBHOOK_SECRET=generate-strong-random-secret-minimum-32-chars
WEBHOOK_SIGNATURE_ALGORITHM=sha256
WEBHOOK_REPLAY_WINDOW=300
```

#### 2. Create Webhook Verification Utility

Create `src/utils/webhookVerification.js`:

```javascript
const crypto = require('crypto');
const logger = require('./logger');

class WebhookVerification {
  constructor() {
    this.secret = process.env.WEBHOOK_SECRET;
    this.algorithm = process.env.WEBHOOK_SIGNATURE_ALGORITHM || 'sha256';
    this.replayWindow = parseInt(process.env.WEBHOOK_REPLAY_WINDOW) || 300; // 5 minutes
    
    if (!this.secret) {
      logger.error('WEBHOOK_SECRET not configured!');
      throw new Error('WEBHOOK_SECRET environment variable is required');
    }
  }
  
  /**
   * Generate HMAC signature for webhook payload
   * @param {object} payload - Webhook payload
   * @param {number} timestamp - Unix timestamp
   * @returns {string} - HMAC signature
   */
  generateSignature(payload, timestamp) {
    const stringPayload = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
    
    const data = `${timestamp}.${stringPayload}`;
    
    return crypto
      .createHmac(this.algorithm, this.secret)
      .update(data)
      .digest('hex');
  }
  
  /**
   * Verify webhook signature
   * @param {string} receivedSignature - Signature from X-Signature header
   * @param {object} payload - Webhook payload
   * @param {number} timestamp - Timestamp from X-Timestamp header
   * @returns {boolean} - True if signature is valid
   */
  verifySignature(receivedSignature, payload, timestamp) {
    try {
      // Extract algorithm and signature
      const [algorithm, signature] = receivedSignature.split('=');
      
      if (algorithm !== this.algorithm) {
        logger.warn(`Invalid signature algorithm: ${algorithm}`);
        return false;
      }
      
      // Generate expected signature
      const expectedSignature = this.generateSignature(payload, timestamp);
      
      // Constant-time comparison to prevent timing attacks
      const receivedBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }
  
  /**
   * Check if webhook is within replay window
   * @param {number} timestamp - Webhook timestamp
   * @returns {boolean} - True if within window
   */
  isWithinReplayWindow(timestamp) {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);
    
    return timeDiff <= this.replayWindow;
  }
  
  /**
   * Verify webhook request completely
   * @param {object} req - Express request object
   * @returns {object} - { valid: boolean, error: string }
   */
  verifyWebhook(req) {
    // Check for required headers
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature) {
      return {
        valid: false,
        error: 'Missing X-Signature header'
      };
    }
    
    if (!timestamp) {
      return {
        valid: false,
        error: 'Missing X-Timestamp header'
      };
    }
    
    // Verify timestamp is within replay window
    const timestampNum = parseInt(timestamp);
    if (isNaN(timestampNum)) {
      return {
        valid: false,
        error: 'Invalid timestamp format'
      };
    }
    
    if (!this.isWithinReplayWindow(timestampNum)) {
      logger.warn(`Webhook replay attack detected. Timestamp: ${timestamp}`);
      return {
        valid: false,
        error: 'Webhook timestamp outside replay window (possible replay attack)'
      };
    }
    
    // Verify signature
    const isValid = this.verifySignature(signature, req.body, timestampNum);
    
    if (!isValid) {
      logger.warn('Invalid webhook signature detected', {
        signature: signature.substring(0, 20),
        timestamp,
        ip: req.ip
      });
      return {
        valid: false,
        error: 'Invalid webhook signature'
      };
    }
    
    return {
      valid: true,
      error: null
    };
  }
}

module.exports = new WebhookVerification();
```

#### 3. Create Webhook Verification Middleware

Create `src/middleware/webhookAuth.js`:

```javascript
const webhookVerification = require('../utils/webhookVerification');
const logger = require('../utils/logger');

/**
 * Middleware to verify webhook authenticity
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    const verification = webhookVerification.verifyWebhook(req);
    
    if (!verification.valid) {
      logger.warn('Webhook verification failed:', {
        error: verification.error,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        error: 'Webhook verification failed',
        message: verification.error
      });
    }
    
    logger.info('Webhook verified successfully', {
      path: req.path,
      timestamp: req.headers['x-timestamp']
    });
    
    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during webhook verification'
    });
  }
};

/**
 * Middleware to parse raw body for signature verification
 * Must be used before bodyParser middleware
 */
const captureRawBody = (req, res, next) => {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

module.exports = {
  verifyWebhookSignature,
  captureRawBody
};
```

#### 4. Update Webhook Routes

Update `src/routes/webhooks.js`:

```javascript
const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/webhookAuth');
const webhookController = require('../controllers/webhookController');

// Apply webhook verification middleware to all webhook routes
router.use(verifyWebhookSignature);

// Webhook endpoints
router.post('/payment', webhookController.handlePaymentWebhook);
router.post('/transaction', webhookController.handleTransactionWebhook);

module.exports = router;
```

#### 5. Update Webhook Controller

Update `src/controllers/webhookController.js`:

```javascript
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');

/**
 * Handle payment confirmation webhook
 * @route POST /api/webhooks/payment
 * @access Public (but signature verified)
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { 
      transaction_hash,
      payment_id,
      confirmations,
      status,
      amount,
      currency
    } = req.body;
    
    logger.info('Payment webhook received:', {
      payment_id,
      transaction_hash,
      status,
      confirmations
    });
    
    // Find payment
    const payment = await Payment.findOne({ transactionHash: transaction_hash });
    
    if (!payment) {
      logger.warn(`Payment not found for transaction: ${transaction_hash}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Prevent duplicate processing
    if (payment.status === 'confirmed' && status === 'confirmed') {
      logger.info(`Payment already confirmed: ${payment_id}`);
      return res.status(200).json({
        success: true,
        message: 'Payment already confirmed'
      });
    }
    
    // Update payment status
    payment.status = status;
    payment.confirmations = confirmations;
    payment.webhookReceivedAt = new Date();
    await payment.save();
    
    // If payment confirmed, update order
    if (status === 'confirmed' && confirmations >= payment.requiredConfirmations) {
      const order = await Order.findById(payment.orderId);
      
      if (order) {
        order.paymentStatus = 'paid';
        order.status = 'processing';
        await order.save();
        
        // Send confirmation email
        await sendEmail({
          to: order.userEmail,
          subject: 'Payment Confirmed',
          template: 'payment-confirmed',
          context: {
            orderId: order._id,
            amount: payment.amount,
            currency: payment.currency
          }
        });
        
        logger.info(`Order ${order._id} payment confirmed`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Error processing payment webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Handle transaction update webhook
 * @route POST /api/webhooks/transaction
 * @access Public (but signature verified)
 */
exports.handleTransactionWebhook = async (req, res) => {
  try {
    const { transaction_hash, confirmations, status } = req.body;
    
    logger.info('Transaction webhook received:', {
      transaction_hash,
      confirmations,
      status
    });
    
    // Find and update transaction
    const payment = await Payment.findOneAndUpdate(
      { transactionHash: transaction_hash },
      {
        confirmations,
        status,
        lastUpdated: new Date()
      },
      { new: true }
    );
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    logger.error('Error processing transaction webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
```

#### 6. Update App Configuration

Update `src/app.js` to handle raw body for webhooks:

```javascript
const express = require('express');
const app = express();

// Raw body parser for webhooks (before JSON parser)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// JSON parser for other routes
app.use(express.json());

// ... rest of your middleware and routes
```

#### 7. Webhook Secret Generation

Create a utility to generate webhook secrets:

```javascript
// scripts/generate-webhook-secret.js
const crypto = require('crypto');

const generateWebhookSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

const secret = generateWebhookSecret();
console.log('Generated Webhook Secret:');
console.log(secret);
console.log('\nAdd this to your .env file:');
console.log(`WEBHOOK_SECRET=${secret}`);
```

Run it:
```bash
node scripts/generate-webhook-secret.js
```

### Testing

#### Unit Tests

Create `tests/webhookVerification.test.js`:

```javascript
const webhookVerification = require('../src/utils/webhookVerification');
const crypto = require('crypto');

describe('Webhook Verification', () => {
  const testPayload = {
    transaction_hash: '0xabc123',
    amount: 0.1,
    status: 'confirmed'
  };
  
  it('should generate valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = webhookVerification.generateSignature(testPayload, timestamp);
    
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // SHA256 hex length
  });
  
  it('should verify valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = webhookVerification.generateSignature(testPayload, timestamp);
    const fullSignature = `sha256=${signature}`;
    
    const isValid = webhookVerification.verifySignature(fullSignature, testPayload, timestamp);
    
    expect(isValid).toBe(true);
  });
  
  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const invalidSignature = 'sha256=invalid_signature_here';
    
    const isValid = webhookVerification.verifySignature(invalidSignature, testPayload, timestamp);
    
    expect(isValid).toBe(false);
  });
  
  it('should reject timestamp outside replay window', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
    
    const isWithinWindow = webhookVerification.isWithinReplayWindow(oldTimestamp);
    
    expect(isWithinWindow).toBe(false);
  });
  
  it('should accept timestamp within replay window', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
    
    const isWithinWindow = webhookVerification.isWithinReplayWindow(recentTimestamp);
    
    expect(isWithinWindow).toBe(true);
  });
});
```

#### Integration Tests

Create `tests/webhooks.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/app');
const webhookVerification = require('../src/utils/webhookVerification');

describe('Webhook Endpoints', () => {
  const validPayload = {
    transaction_hash: '0xabc123',
    payment_id: 'pay_123',
    confirmations: 6,
    status: 'confirmed',
    amount: 0.1,
    currency: 'BTC'
  };
  
  it('should accept webhook with valid signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = webhookVerification.generateSignature(validPayload, timestamp);
    
    const response = await request(app)
      .post('/api/webhooks/payment')
      .set('X-Signature', `sha256=${signature}`)
      .set('X-Timestamp', timestamp.toString())
      .send(validPayload);
    
    expect(response.status).toBe(200);
  });
  
  it('should reject webhook without signature', async () => {
    const response = await request(app)
      .post('/api/webhooks/payment')
      .send(validPayload);
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Webhook verification failed');
  });
  
  it('should reject webhook with invalid signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const response = await request(app)
      .post('/api/webhooks/payment')
      .set('X-Signature', 'sha256=invalid_signature')
      .set('X-Timestamp', timestamp.toString())
      .send(validPayload);
    
    expect(response.status).toBe(401);
  });
});
```

### Client-Side Implementation (Payment Gateway)

Example for sending webhooks with signature:

```javascript
// Payment gateway webhook sender example
const crypto = require('crypto');
const axios = require('axios');

const sendWebhook = async (url, payload, secret) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = `${timestamp}.${JSON.stringify(payload)}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'X-Signature': `sha256=${signature}`,
        'X-Timestamp': timestamp.toString(),
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Webhook sent successfully:', response.status);
  } catch (error) {
    console.error('Webhook failed:', error.message);
  }
};

// Usage
const webhookUrl = 'https://cryptons.com/api/webhooks/payment';
const payload = {
  transaction_hash: '0xabc123',
  status: 'confirmed',
  confirmations: 6
};

sendWebhook(webhookUrl, payload, process.env.WEBHOOK_SECRET);
```

## Production Considerations

### Security Best Practices

1. **Use HTTPS**: Always use TLS for webhook URLs
2. **Strong Secrets**: Generate cryptographically random secrets (64+ characters)
3. **Rotate Secrets**: Implement secret rotation strategy
4. **Log Everything**: Log all webhook attempts for audit
5. **Rate Limiting**: Apply rate limiting to webhook endpoints
6. **IP Whitelisting**: Whitelist payment gateway IPs if possible

### Monitoring

```javascript
// Monitor webhook failures
const webhookMetrics = {
  total: 0,
  success: 0,
  failed: 0,
  invalidSignature: 0,
  replayAttempts: 0
};

// In your webhook middleware
logger.info('Webhook metrics:', webhookMetrics);
```

### Error Handling

```javascript
// Implement retry mechanism for failed webhooks
const retryWebhook = async (payload, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await processWebhook(payload);
      return { success: true };
    } catch (error) {
      logger.warn(`Webhook retry ${attempt}/${maxRetries}:`, error);
      if (attempt === maxRetries) {
        // Alert admins
        await alertAdmins('Webhook processing failed after retries', payload);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return { success: false };
};
```

## Integration with Payment Gateways

### BTCPay Server Configuration

```bash
# Configure BTCPay webhook with signature
WEBHOOK_URL=https://cryptons.com/api/webhooks/payment
WEBHOOK_SECRET=your-webhook-secret
```

### Stripe Integration Example

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe handles signature verification differently
const verifyStripeWebhook = (req) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return { valid: true, event };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};
```

## Success Metrics

- ✅ All webhooks verified before processing
- ✅ Zero successful spoofing attacks
- ✅ < 1% false positive rate
- ✅ 100% replay attack prevention
- ✅ Comprehensive audit logging

---

**Status**: Implementation Required  
**Owner**: Backend Team  
**Estimated Effort**: 30-40 hours  
**Dependencies**: Webhook secret generation and distribution
