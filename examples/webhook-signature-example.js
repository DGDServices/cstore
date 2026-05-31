/**
 * Example: Using the verifyWebhookSignature Middleware
 * 
 * This example demonstrates how to use the verifyWebhookSignature middleware
 * to secure webhook endpoints in your Express application.
 */

const express = require('express');
const crypto = require('crypto');
const { verifyWebhookSignature } = require('../src/middleware/security');

// Create Express app
const app = express();

// Parse JSON bodies
app.use(express.json());

// Set webhook secret (in production, use environment variables)
process.env.WEBHOOK_SECRET = 'your-webhook-secret-key-minimum-32-characters';

// ============================================================================
// EXAMPLE 1: Protected Webhook Endpoint
// ============================================================================

/**
 * Protected webhook endpoint that requires signature verification
 */
app.post('/api/webhooks/payment', verifyWebhookSignature, (req, res) => {
  console.log('✓ Webhook signature verified!');
  console.log('Payment webhook received:', req.body);
  
  // Process the webhook payload
  const { transaction_id, amount, status } = req.body;
  
  // Your business logic here
  // ...
  
  res.json({
    success: true,
    message: 'Payment webhook processed',
    transaction_id
  });
});

// ============================================================================
// EXAMPLE 2: Multiple Protected Endpoints
// ============================================================================

/**
 * Create a router with webhook verification applied to all routes
 */
const webhookRouter = express.Router();

// Apply verification to all routes in this router
webhookRouter.use(verifyWebhookSignature);

webhookRouter.post('/payment', (req, res) => {
  res.json({ success: true, message: 'Payment webhook received' });
});

webhookRouter.post('/order', (req, res) => {
  res.json({ success: true, message: 'Order webhook received' });
});

webhookRouter.post('/refund', (req, res) => {
  res.json({ success: true, message: 'Refund webhook received' });
});

app.use('/api/webhooks', webhookRouter);

// ============================================================================
// EXAMPLE 3: Test Endpoint to Send Webhooks (for testing)
// ============================================================================

/**
 * Test endpoint that generates and sends a signed webhook
 * In production, this would be called by an external service
 */
app.post('/test/send-webhook', (req, res) => {
  const payload = {
    event: 'payment.completed',
    transaction_id: 'txn_' + Date.now(),
    amount: 100,
    currency: 'USD',
    status: 'completed'
  };

  // Calculate signature
  const rawBody = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(rawBody);
  const signature = hmac.digest('hex');

  console.log('\n========================================');
  console.log('Test Webhook Details:');
  console.log('========================================');
  console.log('Payload:', payload);
  console.log('Signature:', signature);
  console.log('========================================\n');

  res.json({
    success: true,
    message: 'Use this signature to test the webhook',
    payload,
    signature,
    curlCommand: `curl -X POST http://localhost:3000/api/webhooks/payment \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: ${signature}" \\
  -d '${rawBody}'`
  });
});

// ============================================================================
// EXAMPLE 4: Unprotected Endpoint (for comparison)
// ============================================================================

/**
 * Unprotected endpoint - no signature verification
 * Use this pattern ONLY for public endpoints that don't need security
 */
app.post('/api/public/contact', (req, res) => {
  console.log('Public contact form received:', req.body);
  res.json({
    success: true,
    message: 'Contact form submitted'
  });
});

// ============================================================================
// Error Handler
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('Webhook Signature Example Server');
    console.log('========================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`\nProtected endpoints:`);
    console.log(`  POST http://localhost:${PORT}/api/webhooks/payment`);
    console.log(`  POST http://localhost:${PORT}/api/webhooks/order`);
    console.log(`  POST http://localhost:${PORT}/api/webhooks/refund`);
    console.log(`\nTest endpoint:`);
    console.log(`  POST http://localhost:${PORT}/test/send-webhook`);
    console.log(`\nTo test, run:`);
    console.log(`  curl -X POST http://localhost:${PORT}/test/send-webhook`);
    console.log('========================================\n');
  });
}

module.exports = app;

// ============================================================================
// CLIENT-SIDE EXAMPLE: Sending Signed Webhooks
// ============================================================================

/**
 * Example function showing how to send a webhook with signature from a client
 */
function sendSignedWebhook(url, payload, secret) {
  const rawBody = JSON.stringify(payload);
  
  // Calculate signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const signature = hmac.digest('hex');
  
  // Send request (using fetch in Node.js 18+ or in browser)
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature
      // Or with prefix: 'X-Webhook-Signature': `sha256=${signature}`
    },
    body: rawBody
  });
}

// Example usage:
// sendSignedWebhook(
//   'http://localhost:3000/api/webhooks/payment',
//   { transaction_id: 'txn_123', amount: 100 },
//   'your-webhook-secret'
// );
