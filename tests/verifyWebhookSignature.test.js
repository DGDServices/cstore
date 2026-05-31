const crypto = require('crypto');
const { verifyWebhookSignature } = require('../src/middleware/security');
const logger = require('../src/utils/logger');

// Mock logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

describe('verifyWebhookSignature Middleware', () => {
  let req, res, next;
  const testSecret = 'test-webhook-secret-key';

  beforeEach(() => {
    // Set up test environment
    process.env.WEBHOOK_SECRET = testSecret;
    
    // Mock request object
    req = {
      headers: {},
      body: {},
      ip: '127.0.0.1',
      path: '/test-webhook'
    };

    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock next function
    next = jest.fn();

    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  describe('Valid signature', () => {
    it('should accept request with valid signature', () => {
      const payload = { event: 'payment', amount: 100 };
      req.body = payload;

      // Calculate valid signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = signature;

      verifyWebhookSignature(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Webhook signature verified successfully',
        expect.objectContaining({ ip: req.ip, path: req.path })
      );
    });

    it('should accept request with signature prefixed with "sha256="', () => {
      const payload = { event: 'payment', amount: 100 };
      req.body = payload;

      // Calculate valid signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = `sha256=${signature}`;

      verifyWebhookSignature(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Invalid signature', () => {
    it('should reject request with invalid signature', () => {
      const payload = { event: 'payment', amount: 100 };
      req.body = payload;
      req.headers['x-webhook-signature'] = 'invalid_signature_12345678901234567890123456789012345678901234567890123456789012';

      verifyWebhookSignature(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature'
      });
    });

    it('should reject request with wrong signature', () => {
      const payload = { event: 'payment', amount: 100 };
      req.body = payload;

      // Calculate signature for different payload
      const differentPayload = { event: 'payment', amount: 200 };
      const rawBody = JSON.stringify(differentPayload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = signature;

      verifyWebhookSignature(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature'
      });
    });
  });

  describe('Missing signature', () => {
    it('should reject request without signature header', () => {
      req.body = { event: 'payment', amount: 100 };

      verifyWebhookSignature(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing webhook signature'
      });
    });
  });

  describe('Missing webhook secret', () => {
    it('should return 500 when webhook secret is not configured', () => {
      delete process.env.WEBHOOK_SECRET;
      req.body = { event: 'payment', amount: 100 };
      req.headers['x-webhook-signature'] = 'some_signature';

      verifyWebhookSignature(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Webhook verification not configured'
      });
    });
  });

  describe('Timing-safe comparison', () => {
    it('should use timing-safe comparison to prevent timing attacks', () => {
      const payload = { event: 'payment', amount: 100 };
      req.body = payload;

      // Create a spy on crypto.timingSafeEqual
      const timingSafeEqualSpy = jest.spyOn(crypto, 'timingSafeEqual');

      // Calculate valid signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = signature;

      verifyWebhookSignature(req, res, next);

      expect(timingSafeEqualSpy).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();

      timingSafeEqualSpy.mockRestore();
    });
  });

  describe('Complex payloads', () => {
    it('should handle complex nested objects', () => {
      const payload = {
        event: 'payment',
        data: {
          amount: 100,
          currency: 'USD',
          customer: {
            id: '123',
            email: 'test@example.com'
          }
        },
        metadata: {
          timestamp: Date.now()
        }
      };
      req.body = payload;

      // Calculate valid signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = signature;

      verifyWebhookSignature(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle empty payload', () => {
      const payload = {};
      req.body = payload;

      // Calculate valid signature
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(rawBody);
      const signature = hmac.digest('hex');

      req.headers['x-webhook-signature'] = signature;

      verifyWebhookSignature(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
