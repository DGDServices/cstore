const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/security');
const {
  handlePaymentWebhook,
  handleTransactionWebhook,
  handleBlockchainWebhook
} = require('../controllers/webhookController');

// Apply webhook verification middleware to all webhook routes
router.use(verifyWebhookSignature);

// Webhook endpoints
router.post('/payment', handlePaymentWebhook);
router.post('/transaction', handleTransactionWebhook);
router.post('/blockchain', handleBlockchainWebhook);

module.exports = router;
