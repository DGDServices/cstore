const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Lightning Network Webhook Service
 * Handles webhook notifications for Lightning payment events
 */
class LightningWebhookService {
  constructor() {
    this.webhookUrls = [];
    this.webhookSecret = process.env.LIGHTNING_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    this.enabled = process.env.LIGHTNING_WEBHOOK_ENABLED === 'true';
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Register a webhook URL
   * @param {string} url - Webhook URL
   * @param {Object} options - Webhook options
   */
  registerWebhook(url, options = {}) {
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const webhook = {
      url,
      events: options.events || ['payment.confirmed', 'payment.failed', 'invoice.expired'],
      active: options.active !== false,
      secret: options.secret || this.webhookSecret,
      createdAt: new Date()
    };

    this.webhookUrls.push(webhook);
    logger.info(`Webhook registered: ${url}`);

    return webhook;
  }

  /**
   * Unregister a webhook URL
   * @param {string} url - Webhook URL
   */
  unregisterWebhook(url) {
    const index = this.webhookUrls.findIndex(w => w.url === url);
    if (index > -1) {
      this.webhookUrls.splice(index, 1);
      logger.info(`Webhook unregistered: ${url}`);
      return true;
    }
    return false;
  }

  /**
   * Generate webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} secret - Webhook secret
   * @returns {string}
   */
  generateSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Received signature
   * @param {string} secret - Webhook secret
   * @returns {boolean}
   */
  verifySignature(payload, signature, secret) {
    try {
      const expectedSignature = this.generateSignature(payload, secret);
      
      // Ensure signatures are the same length for timingSafeEqual
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Send webhook notification
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  async sendWebhook(event, data) {
    if (!this.enabled) {
      logger.debug('Webhooks disabled, skipping notification');
      return;
    }

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      id: crypto.randomBytes(16).toString('hex')
    };

    // Filter webhooks that are subscribed to this event
    const relevantWebhooks = this.webhookUrls.filter(
      w => w.active && w.events.includes(event)
    );

    if (relevantWebhooks.length === 0) {
      logger.debug(`No webhooks registered for event: ${event}`);
      return;
    }

    const results = await Promise.allSettled(
      relevantWebhooks.map(webhook => this.sendWebhookWithRetry(webhook, payload))
    );

    // Log results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        logger.info(`Webhook sent successfully: ${relevantWebhooks[index].url}`);
      } else {
        logger.error(`Webhook failed: ${relevantWebhooks[index].url}`, result.reason);
      }
    });
  }

  /**
   * Send webhook with retry logic
   * @param {Object} webhook - Webhook configuration
   * @param {Object} payload - Webhook payload
   */
  async sendWebhookWithRetry(webhook, payload, attempt = 1) {
    try {
      const signature = this.generateSignature(payload, webhook.secret);

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Lightning-Signature': signature,
          'X-Lightning-Event': payload.event,
          'X-Lightning-Timestamp': payload.timestamp,
          'X-Lightning-ID': payload.id
        },
        timeout: 10000 // 10 seconds
      });

      if (response.status >= 200 && response.status < 300) {
        return { success: true, attempt };
      }

      throw new Error(`Webhook returned status ${response.status}`);
    } catch (error) {
      if (attempt < this.retryAttempts) {
        logger.warn(`Webhook attempt ${attempt} failed, retrying...`, {
          url: webhook.url,
          error: error.message
        });

        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, this.retryDelay * attempt)
        );

        return this.sendWebhookWithRetry(webhook, payload, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Notify payment confirmed
   * @param {Object} invoice - Lightning invoice
   * @param {Object} payment - Payment record
   */
  async notifyPaymentConfirmed(invoice, payment) {
    await this.sendWebhook('payment.confirmed', {
      paymentHash: invoice.paymentHash,
      amount: invoice.amount,
      amountUSD: invoice.amountUSD,
      orderId: invoice.order,
      paidAt: invoice.paidAt,
      preimage: invoice.preimage,
      payment: {
        id: payment._id,
        transactionHash: payment.transactionHash,
        status: payment.status
      }
    });
  }

  /**
   * Notify payment failed
   * @param {Object} invoice - Lightning invoice
   * @param {string} reason - Failure reason
   */
  async notifyPaymentFailed(invoice, reason) {
    await this.sendWebhook('payment.failed', {
      paymentHash: invoice.paymentHash,
      amount: invoice.amount,
      amountUSD: invoice.amountUSD,
      orderId: invoice.order,
      reason,
      failedAt: new Date().toISOString()
    });
  }

  /**
   * Notify invoice expired
   * @param {Object} invoice - Lightning invoice
   */
  async notifyInvoiceExpired(invoice) {
    await this.sendWebhook('invoice.expired', {
      paymentHash: invoice.paymentHash,
      amount: invoice.amount,
      amountUSD: invoice.amountUSD,
      orderId: invoice.order,
      expiresAt: invoice.expiresAt,
      expiredAt: new Date().toISOString()
    });
  }

  /**
   * Notify channel opened
   * @param {Object} channel - Lightning channel
   */
  async notifyChannelOpened(channel) {
    await this.sendWebhook('channel.opened', {
      channelId: channel.channelId,
      remotePubkey: channel.remotePubkey,
      capacity: channel.capacity,
      localBalance: channel.localBalance,
      openedAt: channel.createdAt
    });
  }

  /**
   * Notify channel closed
   * @param {Object} channel - Lightning channel
   * @param {string} reason - Close reason
   */
  async notifyChannelClosed(channel, reason = null) {
    await this.sendWebhook('channel.closed', {
      channelId: channel.channelId,
      remotePubkey: channel.remotePubkey,
      capacity: channel.capacity,
      reason,
      closedAt: new Date().toISOString()
    });
  }

  /**
   * Get all registered webhooks
   * @returns {Array}
   */
  getWebhooks() {
    return this.webhookUrls.map(w => ({
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt
    }));
  }

  /**
   * Enable/disable webhooks globally
   * @param {boolean} enabled - Enable flag
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`Lightning webhooks ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Test webhook delivery
   * @param {string} url - Webhook URL
   * @returns {Promise<Object>}
   */
  async testWebhook(url) {
    const testPayload = {
      event: 'test',
      data: {
        message: 'This is a test webhook from Lightning Network integration',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      id: crypto.randomBytes(16).toString('hex')
    };

    const webhook = {
      url,
      secret: this.webhookSecret,
      events: ['test']
    };

    try {
      await this.sendWebhookWithRetry(webhook, testPayload);
      return { success: true, message: 'Test webhook delivered successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: 'Test webhook failed',
        error: error.message 
      };
    }
  }
}

module.exports = new LightningWebhookService();
