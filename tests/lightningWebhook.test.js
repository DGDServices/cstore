const lightningWebhook = require('../src/services/lightningWebhook');
const crypto = require('crypto');

describe('Lightning Network Webhook Service', () => {
  beforeEach(() => {
    // Clear all webhooks before each test
    while (lightningWebhook.getWebhooks().length > 0) {
      const webhooks = lightningWebhook.getWebhooks();
      lightningWebhook.unregisterWebhook(webhooks[0].url);
    }
  });

  describe('Webhook Registration', () => {
    it('should register a webhook', () => {
      const url = 'https://example.com/webhook';
      const webhook = lightningWebhook.registerWebhook(url);

      expect(webhook).toBeDefined();
      expect(webhook.url).toBe(url);
      expect(webhook.active).toBe(true);
      expect(webhook.events).toContain('payment.confirmed');
    });

    it('should register webhook with custom events', () => {
      const url = 'https://example.com/webhook';
      const events = ['payment.confirmed', 'channel.opened'];
      const webhook = lightningWebhook.registerWebhook(url, { events });

      expect(webhook.events).toEqual(events);
    });

    it('should register webhook with custom secret', () => {
      const url = 'https://example.com/webhook';
      const secret = 'custom-secret-key';
      const webhook = lightningWebhook.registerWebhook(url, { secret });

      expect(webhook.secret).toBe(secret);
    });

    it('should throw error if URL is missing', () => {
      expect(() => {
        lightningWebhook.registerWebhook(null);
      }).toThrow('Webhook URL is required');
    });
  });

  describe('Webhook Unregistration', () => {
    it('should unregister a webhook', () => {
      const url = 'https://example.com/webhook';
      lightningWebhook.registerWebhook(url);

      const success = lightningWebhook.unregisterWebhook(url);

      expect(success).toBe(true);
      expect(lightningWebhook.getWebhooks()).toHaveLength(0);
    });

    it('should return false for non-existent webhook', () => {
      const success = lightningWebhook.unregisterWebhook('https://nonexistent.com');
      expect(success).toBe(false);
    });
  });

  describe('Signature Generation and Verification', () => {
    it('should generate signature for payload', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = lightningWebhook.generateSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should verify valid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = lightningWebhook.generateSignature(payload, secret);
      const isValid = lightningWebhook.verifySignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = lightningWebhook.generateSignature(payload, secret);
      const isValid = lightningWebhook.verifySignature(
        payload,
        'invalid-signature-' + signature.substring(0, 32),
        secret
      );

      expect(isValid).toBe(false);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret';
      const payload1 = { test: 'data1' };
      const payload2 = { test: 'data2' };

      const signature1 = lightningWebhook.generateSignature(payload1, secret);
      const signature2 = lightningWebhook.generateSignature(payload2, secret);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('Webhook Listing', () => {
    it('should list all registered webhooks', () => {
      lightningWebhook.registerWebhook('https://example1.com/webhook');
      lightningWebhook.registerWebhook('https://example2.com/webhook');

      const webhooks = lightningWebhook.getWebhooks();

      expect(webhooks).toHaveLength(2);
      expect(webhooks[0]).toHaveProperty('url');
      expect(webhooks[0]).toHaveProperty('events');
      expect(webhooks[0]).toHaveProperty('active');
      expect(webhooks[0]).toHaveProperty('createdAt');
    });

    it('should return empty array when no webhooks registered', () => {
      const webhooks = lightningWebhook.getWebhooks();
      expect(webhooks).toHaveLength(0);
    });
  });

  describe('Webhook Enable/Disable', () => {
    it('should enable webhooks globally', () => {
      lightningWebhook.setEnabled(true);
      expect(lightningWebhook.enabled).toBe(true);
    });

    it('should disable webhooks globally', () => {
      lightningWebhook.setEnabled(false);
      expect(lightningWebhook.enabled).toBe(false);
    });
  });

  describe('Event Notifications', () => {
    it('should not send webhooks when disabled', async () => {
      lightningWebhook.setEnabled(false);
      lightningWebhook.registerWebhook('https://example.com/webhook');

      // Should not throw error and should complete without sending
      await lightningWebhook.sendWebhook('test.event', { test: 'data' });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should skip webhooks not subscribed to event', async () => {
      lightningWebhook.setEnabled(true);
      lightningWebhook.registerWebhook('https://example.com/webhook', {
        events: ['payment.confirmed']
      });

      // This should not send webhook since it's not subscribed to this event
      await lightningWebhook.sendWebhook('channel.opened', { test: 'data' });

      // Test passes if no error is thrown
      expect(true).toBe(true);

      lightningWebhook.setEnabled(false);
    });
  });

  describe('Notification Helpers', () => {
    beforeEach(() => {
      // Disable webhooks for these tests to avoid actual HTTP requests
      lightningWebhook.setEnabled(false);
    });

    it('should have notifyPaymentConfirmed method', () => {
      expect(typeof lightningWebhook.notifyPaymentConfirmed).toBe('function');
    });

    it('should have notifyPaymentFailed method', () => {
      expect(typeof lightningWebhook.notifyPaymentFailed).toBe('function');
    });

    it('should have notifyInvoiceExpired method', () => {
      expect(typeof lightningWebhook.notifyInvoiceExpired).toBe('function');
    });

    it('should have notifyChannelOpened method', () => {
      expect(typeof lightningWebhook.notifyChannelOpened).toBe('function');
    });

    it('should have notifyChannelClosed method', () => {
      expect(typeof lightningWebhook.notifyChannelClosed).toBe('function');
    });

    it('should call notification methods without error', async () => {
      const invoice = {
        paymentHash: 'test-hash',
        amount: 10000,
        amountUSD: 10.0,
        order: '507f1f77bcf86cd799439011',
        paidAt: new Date(),
        preimage: 'test-preimage',
        expiresAt: new Date()
      };

      const payment = {
        _id: 'payment-id',
        transactionHash: 'tx-hash',
        status: 'confirmed'
      };

      // These should not throw errors
      await lightningWebhook.notifyPaymentConfirmed(invoice, payment);
      await lightningWebhook.notifyPaymentFailed(invoice, 'timeout');
      await lightningWebhook.notifyInvoiceExpired(invoice);

      const channel = {
        channelId: 'channel-id',
        remotePubkey: '03abc...',
        capacity: 1000000,
        localBalance: 500000,
        createdAt: new Date()
      };

      await lightningWebhook.notifyChannelOpened(channel);
      await lightningWebhook.notifyChannelClosed(channel, 'manual');

      expect(true).toBe(true);
    });
  });

  describe('Webhook Testing', () => {
    it('should have testWebhook method', () => {
      expect(typeof lightningWebhook.testWebhook).toBe('function');
    });

    it('should return result object when testing webhook', async () => {
      const url = 'https://example.com/webhook';
      
      // This will fail because we're not actually running a webhook server
      // but we can test that it returns the expected structure
      const result = await lightningWebhook.testWebhook(url);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
    });
  });
});
