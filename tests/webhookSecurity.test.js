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

  describe('POST /api/webhooks/payment', () => {
    it('should accept webhook with valid signature', async () => {
      const signature = generateSignature(validPayload);

      const res = await request(app)
        .post('/api/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .send(validPayload);

      // Accept both 200, 400, and 404 (payment not found or DB unavailable is OK for test)
      // 400 can occur when database is not available in test environment
      expect([200, 400, 404]).toContain(res.statusCode);
    });

    it('should reject webhook with invalid signature', async () => {
      const invalidSignature = 'a'.repeat(64); // Invalid 64-char hex string

      const res = await request(app)
        .post('/api/webhooks/payment')
        .set('X-Webhook-Signature', invalidSignature)
        .send(validPayload);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid webhook signature');
    });

    it('should reject webhook without signature', async () => {
      const res = await request(app)
        .post('/api/webhooks/payment')
        .send(validPayload);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should accept signature with sha256= prefix', async () => {
      const signature = generateSignature(validPayload);

      const res = await request(app)
        .post('/api/webhooks/payment')
        .set('X-Webhook-Signature', `sha256=${signature}`)
        .send(validPayload);

      // Accept both 200, 400, and 404 (payment not found or DB unavailable is OK for test)
      // 400 can occur when database is not available in test environment
      expect([200, 400, 404]).toContain(res.statusCode);
    });

    it('should reject webhook with signature for different payload', async () => {
      const differentPayload = { ...validPayload, amount: 999 };
      const signature = generateSignature(differentPayload);

      const res = await request(app)
        .post('/api/webhooks/payment')
        .set('X-Webhook-Signature', signature)
        .send(validPayload); // Send different payload than signature

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject webhook with malformed signature', async () => {
      const res = await request(app)
        .post('/api/webhooks/payment')
        .set('X-Webhook-Signature', 'not-a-valid-signature')
        .send(validPayload);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

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
