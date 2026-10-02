const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const webhookVerification = require('../src/utils/webhookVerification');

describe('Webhook Signature Verification', () => {
  const validPayload = {
    transaction_hash: '0xabc123',
    payment_id: 'pay_123',
    confirmations: 6,
    status: 'confirmed',
    amount: 0.1,
    currency: 'BTC'
  };

  beforeAll(() => {
    // Set webhook secret for tests
    process.env.WEBHOOK_SECRET = 'test-webhook-secret-for-testing-only';
  });

  /**
   * Generate HMAC-SHA256 signature for webhook payload (security.js format)
   * @param {Object} payload - Webhook payload
   * @returns {string} - Hex signature
   */
  const generateSignature = (payload) => {
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
    hmac.update(rawBody);
    return hmac.digest('hex');
  };

  // The legacy /api/webhooks/payment route (multi-coin payment webhooks) was
  // removed with the legacy settlement code (D5). The signature utility below
  // is still used by the generic webhookAuth middleware.

  describe('Webhook Verification Utility', () => {
    it('should generate valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = webhookVerification.generateSignature(validPayload, timestamp);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex is 64 chars
    });

    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = webhookVerification.generateSignature(validPayload, timestamp);
      
      const isValid = webhookVerification.verifySignature(signature, validPayload, timestamp);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = 'a'.repeat(64);
      
      const isValid = webhookVerification.verifySignature(invalidSignature, validPayload, timestamp);
      expect(isValid).toBe(false);
    });

    it('should reject signature for different payload', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = webhookVerification.generateSignature(validPayload, timestamp);
      
      const differentPayload = { ...validPayload, amount: 999 };
      const isValid = webhookVerification.verifySignature(signature, differentPayload, timestamp);
      expect(isValid).toBe(false);
    });

    it('should reject signature for different timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = webhookVerification.generateSignature(validPayload, timestamp);
      
      const differentTimestamp = timestamp + 60;
      const isValid = webhookVerification.verifySignature(signature, validPayload, differentTimestamp);
      expect(isValid).toBe(false);
    });
  });
});
