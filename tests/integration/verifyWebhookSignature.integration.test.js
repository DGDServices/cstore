const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { verifyWebhookSignature } = require('../../src/middleware/security');

describe('verifyWebhookSignature Integration Test', () => {
  let app;
  const testSecret = 'test-integration-webhook-secret';

  beforeAll(() => {
    process.env.WEBHOOK_SECRET = testSecret;

    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Protected webhook endpoint
    app.post('/webhook', verifyWebhookSignature, (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Webhook received',
        data: req.body
      });
    });

    // Unprotected test endpoint
    app.post('/test', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Test endpoint'
      });
    });
  });

  afterAll(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  describe('Protected webhook endpoint', () => {
    it('should accept webhook with valid signature', async () => {
      const payload = {
        event: 'payment.completed',
        transaction_id: 'txn_123',
        amount: 100
      };

      // Calculate signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(payload);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'payment.completed',
        transaction_id: 'txn_123',
        amount: 100
      };

      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Signature', 'invalid_signature_1234567890123456789012345678901234567890123456789012345678901234')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid webhook signature');
    });

    it('should reject webhook without signature', async () => {
      const payload = {
        event: 'payment.completed',
        transaction_id: 'txn_123',
        amount: 100
      };

      const response = await request(app)
        .post('/webhook')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing webhook signature');
    });

    it('should accept signature with sha256= prefix', async () => {
      const payload = {
        event: 'payment.completed',
        transaction_id: 'txn_123',
        amount: 100
      };

      // Calculate signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Signature', `sha256=${signature}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle complex nested payloads', async () => {
      const payload = {
        event: 'order.created',
        order: {
          id: 'order_123',
          items: [
            { product_id: 'prod_1', quantity: 2, price: 50 },
            { product_id: 'prod_2', quantity: 1, price: 100 }
          ],
          customer: {
            id: 'cust_456',
            email: 'test@example.com',
            shipping: {
              address: '123 Main St',
              city: 'New York',
              country: 'US'
            }
          }
        },
        metadata: {
          timestamp: Date.now(),
          source: 'api'
        }
      };

      // Calculate signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(payload);
    });
  });

  describe('Unprotected endpoint', () => {
    it('should accept requests without signature', async () => {
      const payload = { test: 'data' };

      const response = await request(app)
        .post('/test')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
